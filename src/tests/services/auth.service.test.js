const authService = require('../../services/auth.service')
const { ConflictError, AuthError } = require('../../utils/errors/errors')
const { createMockUser, createObjectId } = require('../helpers')

jest.mock('../../repositories')
jest.mock('../../services/auth/credentials')

const { userRepository, refreshTokenRepository } = require('../../repositories')
const { verifyCredentials } = require('../../services/auth/credentials')

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('signup', () => {
    it('should create new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password@123',
      }
      const mockUser = createMockUser(userData)

      userRepository.create.mockResolvedValue(mockUser)

      const result = await authService.signup(userData)

      expect(userRepository.create).toHaveBeenCalledWith(userData)
      expect(result.username).toBe(userData.username)
      expect(result.email).toBe(userData.email)
      expect(result).not.toHaveProperty('password')
    })

    it('should throw ConflictError for duplicate email', async () => {
      const userData = { email: 'existing@example.com' }
      const error = { code: 11000, keyPattern: { email: 1 } }

      userRepository.create.mockRejectedValue(error)

      await expect(authService.signup(userData)).rejects.toThrow(ConflictError)
      await expect(authService.signup(userData)).rejects.toThrow('Email already exists')
    })

    it('should throw ConflictError for duplicate username', async () => {
      const userData = { username: 'existing' }
      const error = { code: 11000, keyPattern: { username: 1 } }

      userRepository.create.mockRejectedValue(error)

      await expect(authService.signup(userData)).rejects.toThrow(ConflictError)
      await expect(authService.signup(userData)).rejects.toThrow('Username already taken')
    })

    it('should rethrow non-duplicate errors', async () => {
      const error = new Error('Database error')
      userRepository.create.mockRejectedValue(error)

      await expect(authService.signup({})).rejects.toThrow('Database error')
    })
  })

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockUser = createMockUser()
      verifyCredentials.mockResolvedValue(mockUser)
      refreshTokenRepository.create.mockResolvedValue({})

      const result = await authService.login({
        username: 'testuser',
        password: 'Password@123',
      })

      expect(verifyCredentials).toHaveBeenCalled()
      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.username).toBe(mockUser.username)
    })

    it('should store refresh token in database', async () => {
      const mockUser = createMockUser()
      verifyCredentials.mockResolvedValue(mockUser)
      refreshTokenRepository.create.mockResolvedValue({})

      const result = await authService.login({
        username: 'test',
        password: 'pass',
      })

      expect(refreshTokenRepository.create).toHaveBeenCalledWith({
        user: mockUser._id,
        refreshToken: result.refreshToken,
      })
    })

    it('should generate valid tokens', async () => {
      const mockUser = createMockUser()
      verifyCredentials.mockResolvedValue(mockUser)
      refreshTokenRepository.create.mockResolvedValue({})

      const result = await authService.login({
        username: 'test',
        password: 'pass',
      })

      expect(typeof result.accessToken).toBe('string')
      expect(typeof result.refreshToken).toBe('string')
      expect(result.accessToken).not.toBe(result.refreshToken)
    })
  })

  describe('logout', () => {
    it('should delete refresh token successfully', async () => {
      refreshTokenRepository.deleteOne.mockResolvedValue({ deletedCount: 1 })

      await authService.logout('userId', 'refresh_token')

      expect(refreshTokenRepository.deleteOne).toHaveBeenCalledWith({
        user: 'userId',
        refreshToken: 'refresh_token',
      })
    })

    it('should throw AuthError when refresh token is invalid', async () => {
      refreshTokenRepository.deleteOne.mockResolvedValue({ deletedCount: 0 })

      await expect(authService.logout('userId', 'invalid_token')).rejects.toThrow(AuthError)
      await expect(authService.logout('userId', 'invalid_token')).rejects.toThrow(
        'Invalid refresh token'
      )
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh tokens successfully', async () => {
      const user = {
        id: createObjectId(),
        username: 'testuser',
        role: 'user',
      }
      const oldToken = 'old_refresh_token'
      const tokenDoc = { _id: 'tokenId', refreshToken: oldToken }

      refreshTokenRepository.findOne.mockResolvedValue(tokenDoc)
      refreshTokenRepository.deleteOne.mockResolvedValue({})
      refreshTokenRepository.create.mockResolvedValue({})

      const result = await authService.refreshAccessToken(oldToken, user)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })

    it('should throw AuthError when refresh token does not exist', async () => {
      const user = { id: 'userId', username: 'test', role: 'user' }
      refreshTokenRepository.findOne.mockResolvedValue(null)

      await expect(authService.refreshAccessToken('invalid', user)).rejects.toThrow(AuthError)
    })

    it('should delete old refresh token', async () => {
      const user = { id: 'userId', username: 'test', role: 'user' }
      const tokenDoc = { _id: 'tokenId', refreshToken: 'old' }

      refreshTokenRepository.findOne.mockResolvedValue(tokenDoc)
      refreshTokenRepository.deleteOne.mockResolvedValue({})
      refreshTokenRepository.create.mockResolvedValue({})

      await authService.refreshAccessToken('old', user)

      expect(refreshTokenRepository.deleteOne).toHaveBeenCalledWith({ _id: 'tokenId' })
    })

    it('should store new refresh token', async () => {
      const user = { id: 'userId', username: 'test', role: 'user' }
      const tokenDoc = { _id: 'tokenId' }

      refreshTokenRepository.findOne.mockResolvedValue(tokenDoc)
      refreshTokenRepository.deleteOne.mockResolvedValue({})
      refreshTokenRepository.create.mockResolvedValue({})

      const result = await authService.refreshAccessToken('old', user)

      expect(refreshTokenRepository.create).toHaveBeenCalledWith({
        user: user.id,
        refreshToken: result.refreshToken,
      })
    })
  })
})