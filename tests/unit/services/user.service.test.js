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
    it('should create a new user', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password@123',
      }
      const mockUser = createMockUser(userData)

      userRepository.create.mockResolvedValue(mockUser)

      const result = await userService.createUser(userData)

      expect(userRepository.create).toHaveBeenCalledWith(userData)
      expect(result.username).toBe(userData.username)
      expect(result.email).toBe(userData.email)
    })

    it('should throw ConflictError for duplicate email', async () => {
      const userData = { email: 'existing@example.com' }
      userRepository.create.mockRejectedValue(
        new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
      )

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
      await expect(userService.createUser(userData)).rejects.toThrow('Email already exists')
    })

    it('should throw ConflictError for duplicate username', async () => {
      const userData = { username: 'existing' }
      userRepository.create.mockRejectedValue(
        new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
      )

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
      await expect(userService.createUser(userData)).rejects.toThrow('Username already taken')
    })
  })

  describe('findAllUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [createMockUser(), createMockUser()]
      userRepository.countDocuments.mockResolvedValue(10)
      userRepository.findAll.mockResolvedValue(mockUsers)

      const result = await userService.findAllUsers({
        skip: 0,
        limit: 20,
        sort: { createdAt: -1 },
      })

      expect(result.users).toHaveLength(2)
      expect(result.total).toBe(10)
    })

    it('should apply search filter', async () => {
      userRepository.countDocuments.mockResolvedValue(1)
      userRepository.findAll.mockResolvedValue([createMockUser()])

      await userService.findAllUsers({ search: 'test' })

      expect(userRepository.countDocuments).toHaveBeenCalledWith({}, 'test')
    })

    it('should apply custom filters', async () => {
      userRepository.countDocuments.mockResolvedValue(1)
      userRepository.findAll.mockResolvedValue([createMockUser()])

      await userService.findAllUsers({ filter: { role: 'admin' } })

      expect(userRepository.countDocuments).toHaveBeenCalledWith({ role: 'admin' }, undefined)
    })
  })

  describe('findUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = createMockUser()
      userRepository.findById.mockResolvedValue(mockUser)

      const result = await userService.findUserById(mockUser.id)

      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id)
      expect(result.id).toEqual(mockUser.id)
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.findUserById('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = crypto.randomUUID()
      const mockUser = createMockUser({ id: userId, password: 'hashed' })
      const updateData = { username: 'newusername' }

      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.updateById.mockResolvedValue({ ...mockUser, ...updateData })

      const result = await userService.updateUser(userId, updateData)

      expect(result.username).toBe('newusername')
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.updateUser('nonexistent', {})).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteUser', () => {
    it('should delete user and remove their avatar from S3', async () => {
      const mockUser = createMockUser({ avatar: 'test-avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockResolvedValue()

      await userService.deleteUser(mockUser.id)

      expect(s3Service.deleteFile).toHaveBeenCalledWith(mockUser.avatar)
      expect(userRepository.findByIdAndDelete).toHaveBeenCalledWith(mockUser.id)
    })

    it('should delete user without avatar', async () => {
      const mockUser = createMockUser({ avatar: null })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)

      await userService.deleteUser(mockUser.id)

      expect(s3Service.deleteFile).not.toHaveBeenCalled()
      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('should continue deletion even if S3 avatar removal fails', async () => {
      const mockUser = createMockUser({ avatar: 'test-avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockRejectedValue(new Error('S3 error'))

      await userService.deleteUser(mockUser.id)

      // S3 failure must not block the account deletion
      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.deleteUser('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateAvatar', () => {
    // Reusable mock file matching the shape the service expects
    const mockFile = {
      buffer: Buffer.from('image-data'),
      mimetype: 'image/jpeg',
    }

    it('should upload new avatar and delete old one from S3', async () => {
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

    it('should upload avatar when user has no existing avatar', async () => {
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

    it('should continue upload even if deleting old avatar from S3 fails', async () => {
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

    it('should throw and not update DB if S3 upload fails', async () => {
      const mockUser = createMockUser({ avatar: null })

      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.uploadFile.mockRejectedValue(new Error('S3 upload failed'))

      await expect(userService.updateAvatar(mockUser.id, mockFile)).rejects.toThrow(
        'S3 upload failed'
      )
      expect(userRepository.updateById).not.toHaveBeenCalled()
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.updateAvatar('nonexistent', mockFile)).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteAvatar', () => {
    it('should delete avatar from S3, clear it in DB, and return updated user', async () => {
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

    it('should skip S3 delete and still clear DB when user has no avatar', async () => {
      const mockUser = createMockUser({ avatar: null })
      const updatedUser = { ...mockUser, avatar: null }

      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.deleteAvatar.mockResolvedValue(updatedUser)

      const result = await userService.deleteAvatar(mockUser.id)

      expect(s3Service.deleteFile).not.toHaveBeenCalled()
      expect(userRepository.deleteAvatar).toHaveBeenCalledWith(mockUser.id)
      expect(result.avatar).toBeUndefined()
    })

    it('should rethrow error and not update DB if S3 delete fails', async () => {
      const mockUser = createMockUser({ avatar: 'avatar-key' })
      userRepository.findById.mockResolvedValue(mockUser)
      s3Service.deleteFile.mockRejectedValue(new Error('S3 error'))

      await expect(userService.deleteAvatar(mockUser.id)).rejects.toThrow('S3 error')
      expect(userRepository.deleteAvatar).not.toHaveBeenCalled()
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.deleteAvatar('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('changePassword', () => {
    it('should change password successfully', async () => {
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

    it('should throw AuthenticationError for incorrect current password', async () => {
      const mockUser = createMockUser({ password_hash: 'hashed' })
      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(userService.changePassword(mockUser.id, 'wrong', 'new')).rejects.toThrow(
        AuthenticationError
      )
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findByIdWithPassword.mockResolvedValue(null)

      await expect(userService.changePassword('nonexistent', 'old', 'new')).rejects.toThrow(
        NotFoundError
      )
    })
  })
})
