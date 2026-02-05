// IMPORTANT: Mock bcrypt BEFORE any imports that use it
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))
jest.mock('@repositories')
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
  },
}))

const fs = require('fs').promises
const bcrypt = require('bcrypt')
const userService = require('@services/user.service')
const { NotFoundError, ConflictError, AuthenticationError } = require('@errors')
const { createMockUser, createObjectId } = require('@tests/unit/helpers')
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
      const error = { code: 11000, keyPattern: { email: 1 } }

      userRepository.create.mockRejectedValue(error)

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
      await expect(userService.createUser(userData)).rejects.toThrow(
        'This email address is already registered. Please log in instead.'
      )
    })

    it('should throw ConflictError for duplicate username', async () => {
      const userData = { username: 'existing' }
      const error = { code: 11000, keyPattern: { username: 1 } }

      userRepository.create.mockRejectedValue(error)

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
      await expect(userService.createUser(userData)).rejects.toThrow(
        'That username is already taken. Please try another one.'
      )
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

      expect(userRepository.countDocuments).toHaveBeenCalledWith({
        $or: [
          { username: { $regex: 'test', $options: 'i' } },
          { email: { $regex: 'test', $options: 'i' } },
        ],
      })
    })

    it('should apply custom filters', async () => {
      userRepository.countDocuments.mockResolvedValue(1)
      userRepository.findAll.mockResolvedValue([createMockUser()])

      await userService.findAllUsers({ filter: { role: 'admin' } })

      expect(userRepository.countDocuments).toHaveBeenCalledWith({ role: 'admin' })
    })
  })

  describe('findUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = createMockUser()
      userRepository.findById.mockResolvedValue(mockUser)

      const result = await userService.findUserById(mockUser._id)

      expect(userRepository.findById).toHaveBeenCalledWith(mockUser._id)
      expect(result.id).toEqual(mockUser._id)
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(userService.findUserById('nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = createObjectId()
      const mockUser = createMockUser({ _id: userId, password: 'hashed' })
      const updateData = { username: 'newusername' }

      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      userRepository.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        ...updateData,
      })

      const result = await userService.updateUser(userId, updateData)

      expect(result.username).toBe('newusername')
    })

    it('should verify old password when changing email', async () => {
      const userId = createObjectId()
      const mockUser = createMockUser({ password: 'hashed' })

      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      userRepository.findByIdAndUpdate.mockResolvedValue(mockUser)

      await userService.updateUser(userId, { email: 'new@example.com' }, 'oldpassword')

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'hashed')
    })

    it('should throw AuthError for incorrect old password', async () => {
      const userId = createObjectId()
      const mockUser = createMockUser({ password: 'hashed' })

      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(
        userService.updateUser(userId, { email: 'new@example.com' }, 'wrong')
      ).rejects.toThrow(AuthenticationError)
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepository.findByIdWithPassword.mockResolvedValue(null)

      await expect(userService.updateUser('nonexistent', {})).rejects.toThrow(NotFoundError)
    })
  })

  describe('deleteUser', () => {
    it('should delete user and avatar', async () => {
      const mockUser = createMockUser({ avatar: 'test.jpg' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      fs.unlink.mockResolvedValue()

      await userService.deleteUser(mockUser._id)

      expect(fs.unlink).toHaveBeenCalled()
      expect(userRepository.findByIdAndDelete).toHaveBeenCalledWith(mockUser._id)
    })

    it('should delete user without avatar', async () => {
      const mockUser = createMockUser({ avatar: null })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)

      await userService.deleteUser(mockUser._id)

      expect(fs.unlink).not.toHaveBeenCalled()
      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('should continue deletion even if avatar deletion fails', async () => {
      const mockUser = createMockUser({ avatar: 'test.jpg' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndDelete.mockResolvedValue(mockUser)
      fs.unlink.mockRejectedValue(new Error('File not found'))

      await userService.deleteUser(mockUser._id)

      expect(userRepository.findByIdAndDelete).toHaveBeenCalled()
    })
  })

  describe('updateAvatar', () => {
    it('should update avatar and delete old one', async () => {
      const mockUser = createMockUser({ avatar: 'old.jpg' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        avatar: 'new.jpg',
      })
      fs.unlink.mockResolvedValue()

      const result = await userService.updateAvatar(mockUser._id, 'new.jpg')

      expect(fs.unlink).toHaveBeenCalled()
      expect(result.avatar).toBe('new.jpg')
    })

    it('should remove avatar when filename is null', async () => {
      const mockUser = createMockUser({ avatar: 'test.jpg' })
      userRepository.findById.mockResolvedValue(mockUser)
      userRepository.deleteAvatar.mockResolvedValue({
        ...mockUser,
        avatar: undefined,
      })
      fs.unlink.mockResolvedValue()

      await userService.updateAvatar(mockUser._id, null)

      expect(userRepository.deleteAvatar).toHaveBeenCalled()
    })
  })

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = createMockUser({ password: 'oldhashed' })
      mockUser.save = jest.fn()

      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      await userService.changePassword(mockUser._id, 'oldpass', 'newpass')

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpass', 'oldhashed')
      expect(mockUser.password).toBe('newpass')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should throw AuthError for incorrect old password', async () => {
      const mockUser = createMockUser({ password: 'hashed' })
      userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(false)

      await expect(userService.changePassword(mockUser._id, 'wrong', 'new')).rejects.toThrow(
        AuthenticationError
      )
    })
  })
})
