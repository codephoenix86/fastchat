jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))
jest.mock('@repositories')
jest.mock('@config')

const bcrypt = require('bcrypt')
const crypto = require('crypto')
const s3Service = require('@services/s3.service')
const userService = require('@services/user.service')
const { NotFoundError, ConflictError, AuthenticationError } = require('@errors')
const { createMockUser } = require('@tests/unit/helpers')
const { userRepository } = require('@repositories')

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createUser', () => {
    it('creates and returns a new user', async () => {
      const userData = { username: 'newuser', email: 'new@example.com', password: 'Password@123' }
      const mockUser = createMockUser(userData)
      userRepository.create.mockResolvedValue(mockUser)

      const result = await userService.createUser(userData)

      expect(userRepository.create).toHaveBeenCalledWith(userData)
      expect(result.username).toBe(userData.username)
      expect(result.email).toBe(userData.email)
    })

    it('throws ConflictError for a duplicate email', async () => {
      userRepository.create.mockRejectedValue(
        new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
      )

      await expect(userService.createUser({ email: 'existing@example.com' })).rejects.toThrow(
        ConflictError
      )
    })

    it('throws ConflictError for a duplicate username', async () => {
      userRepository.create.mockRejectedValue(
        new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
      )

      await expect(userService.createUser({ username: 'existing' })).rejects.toThrow(ConflictError)
    })
  })

  describe('findAllUsers', () => {
    it('returns paginated users', async () => {
      const mockUsers = [createMockUser(), createMockUser()]
      userRepository.countDocuments.mockResolvedValue(10)
      userRepository.findAll.mockResolvedValue(mockUsers)

      const result = await userService.findAllUsers({ skip: 0, limit: 20, sort: { createdAt: -1 } })

      expect(result.users).toHaveLength(2)
      expect(result.total).toBe(10)
    })

    it('passes search term to countDocuments', async () => {
      userRepository.countDocuments.mockResolvedValue(1)
      userRepository.findAll.mockResolvedValue([createMockUser()])

      await userService.findAllUsers({ search: 'test' })

      expect(userRepository.countDocuments).toHaveBeenCalledWith({}, 'test')
    })

    it('passes custom filters to countDocuments', async () => {
      userRepository.countDocuments.mockResolvedValue(1)
      userRepository.findAll.mockResolvedValue([createMockUser()])

      await userService.findAllUsers({ filter: { role: 'admin' } })

      expect(userRepository.countDocuments).toHaveBeenCalledWith({ role: 'admin' }, undefined)
    })
  })

  describe('findUserById', () => {
    it('returns the user by ID', async () => {
      const mockUser = createMockUser()
      userRepository.findById.mockResolvedValue(mockUser)

      const result = await userService.findUserById(mockUser.id)

      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id)
      expect(result.id).toEqual(mockUser.id)
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.findUserById('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateUser', () => {
    it('updates and returns the user', async () => {
      const userId = crypto.randomUUID()
      const mockUser = createMockUser({ id: userId })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.updateById.mockResolvedValue({ ...mockUser, username: 'newusername' })

      const result = await userService.updateUser(userId, { username: 'newusername' })

      expect(result.username).toBe('newusername')
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.updateUser('nonexistent', {})).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteUser', () => {
    it('deletes the user and removes their avatar from S3', async () => {
      const mockUser = createMockUser({ avatar: 'test-avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockResolvedValue()

      await userService.deleteUser(mockUser.id)

      expect(s3Service.deleteFile).toHaveBeenCalledWith(mockUser.avatar)
      expect(userRepository.findByIdAndDelete).toHaveBeenCalledWith(mockUser.id)
    })

    it('skips S3 deletion when user has no avatar', async () => {
      const mockUser = createMockUser({ avatar: null })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)

      await userService.deleteUser(mockUser.id)

      expect(s3Service.deleteFile).not.toHaveBeenCalled()
      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('completes deletion even if S3 avatar removal fails', async () => {
      const mockUser = createMockUser({ avatar: 'test-avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockRejectedValue(new Error('S3 error'))

      await userService.deleteUser(mockUser.id)

      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.deleteUser('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateAvatar', () => {
    const mockFile = { buffer: Buffer.from('image-data'), mimetype: 'image/jpeg' }

    it('uploads a new avatar and deletes the old one from S3', async () => {
      const mockUser = createMockUser({ avatar: 'old-avatar-key' })
      const updatedUser = { ...mockUser, avatar: 'new-avatar-key' }
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockResolvedValue()
      s3Service.uploadFile.mockResolvedValue('s3.url')
      userRepository.updateById.mockResolvedValue(updatedUser)

      const result = await userService.updateAvatar(mockUser.id, mockFile)

      expect(s3Service.deleteFile).toHaveBeenCalledWith(mockUser.avatar)
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.any(String),
        mockFile.mimetype
      )
      expect(userRepository.updateById).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ avatar: 's3.url' })
      )
      expect(result.avatar).toBe('new-avatar-key')
    })

    it('uploads avatar when user has no existing one', async () => {
      const mockUser = createMockUser({ avatar: null })
      const updatedUser = { ...mockUser, avatar: 'new-avatar-key' }
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.uploadFile.mockResolvedValue()
      userRepository.updateById.mockResolvedValue(updatedUser)

      const result = await userService.updateAvatar(mockUser.id, mockFile)

      expect(s3Service.deleteFile).not.toHaveBeenCalled()
      expect(s3Service.uploadFile).toHaveBeenCalled()
      expect(result.avatar).toBe('new-avatar-key')
    })

    it('continues upload even if deleting the old avatar from S3 fails', async () => {
      const mockUser = createMockUser({ avatar: 'old-avatar-key' })
      const updatedUser = { ...mockUser, avatar: 'new-avatar-key' }
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockRejectedValue(new Error('S3 delete failed'))
      s3Service.uploadFile.mockResolvedValue()
      userRepository.updateById.mockResolvedValue(updatedUser)

      const result = await userService.updateAvatar(mockUser.id, mockFile)

      expect(s3Service.uploadFile).toHaveBeenCalled()
      expect(result.avatar).toBe('new-avatar-key')
    })

    it('throws and does not update DB when S3 upload fails', async () => {
      const mockUser = createMockUser({ avatar: null })
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.uploadFile.mockRejectedValue(new Error('S3 upload failed'))

      await expect(userService.updateAvatar(mockUser.id, mockFile)).rejects.toThrow(
        'S3 upload failed'
      )
      expect(userRepository.updateById).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.updateAvatar('nonexistent', mockFile)).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteAvatar', () => {
    it('deletes from S3, clears DB, and returns updated user', async () => {
      const mockUser = createMockUser({ avatar: 'avatar-key' })
      const updatedUser = { ...mockUser, avatar: null }
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockResolvedValue()
      userRepository.deleteAvatar.mockResolvedValue(updatedUser)

      const result = await userService.deleteAvatar(mockUser.id)

      expect(s3Service.deleteFile).toHaveBeenCalledWith(mockUser.avatar)
      expect(userRepository.deleteAvatar).toHaveBeenCalledWith(mockUser.id)
      expect(result.avatar).toBeUndefined()
    })

    it('skips S3 delete and still clears DB when user has no avatar', async () => {
      const mockUser = createMockUser({ avatar: null })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.deleteAvatar.mockResolvedValue({ ...mockUser, avatar: null })

      const result = await userService.deleteAvatar(mockUser.id)

      expect(s3Service.deleteFile).not.toHaveBeenCalled()
      expect(userRepository.deleteAvatar).toHaveBeenCalledWith(mockUser.id)
      expect(result.avatar).toBeUndefined()
    })

    it('rethrows error and does not update DB when S3 delete fails', async () => {
      const mockUser = createMockUser({ avatar: 'avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockRejectedValue(new Error('S3 error'))

      await expect(userService.deleteAvatar(mockUser.id)).rejects.toThrow('S3 error')
      expect(userRepository.deleteAvatar).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.deleteAvatar('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('changePassword', () => {
    it('verifies old password and updates with new hash', async () => {
      const mockUser = createMockUser({ password_hash: 'oldhashed' })
      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      bcrypt.hash.mockResolvedValue('new_hash')

      await userService.changePassword(mockUser.id, 'oldpass', 'newpass')

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpass', 'oldhashed')
      expect(userRepository.updateById).toHaveBeenCalledWith(mockUser.id, {
        password_hash: 'new_hash',
      })
    })

    it('throws AuthenticationError for an incorrect current password', async () => {
      const mockUser = createMockUser({ password_hash: 'hashed' })
      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(userService.changePassword(mockUser.id, 'wrong', 'new')).rejects.toThrow(
        AuthenticationError
      )
    })

    it('throws NotFoundError when the user does not exist', async () => {
      userRepository.findByIdWithPassword.mockResolvedValue(null)

      await expect(userService.changePassword('nonexistent', 'old', 'new')).rejects.toThrow(
        NotFoundError
      )
    })
  })
})
