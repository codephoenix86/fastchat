const crypto = require('crypto')
const authService = require('@services/auth.service')
const userService = require('@services/user.service')
const { ConflictError, AuthenticationError } = require('@errors')
const { createMockUser } = require('@tests/unit/helpers')
const tokenService = require('@services/token.service')

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))
jest.mock('@repositories')
jest.mock('@services/user.service')
jest.mock('@config/redis', () => {
  const client = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }
  return {
    getClient: () => client,
  }
})
jest.mock('@services/token.service')

const bcrypt = require('bcrypt')

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
      userService.createUser.mockResolvedValue(mockUser)
      bcrypt.hash.mockResolvedValue('hashed_password')

      const result = await authService.signup(userData)

      expect(userService.createUser).toHaveBeenCalledWith({
        username: userData.username,
        email: userData.email,
        password_hash: 'hashed_password',
      })
      expect(result.username).toBe(userData.username)
      expect(result.email).toBe(userData.email)
      expect(result).not.toHaveProperty('password_hash')
    })

    it('should throw ConflictError for duplicate email', async () => {
      const userData = { email: 'existing@example.com' }

      userService.createUser.mockRejectedValue(
        new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
      )

      await expect(authService.signup(userData)).rejects.toThrow(ConflictError)
      await expect(authService.signup(userData)).rejects.toThrow('Email already exists')
    })

    it('should throw ConflictError for duplicate username', async () => {
      const userData = { username: 'existing' }
      userService.createUser.mockRejectedValue(
        new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
      )

      await expect(authService.signup(userData)).rejects.toThrow(ConflictError)
      await expect(authService.signup(userData)).rejects.toThrow('Username already taken')
    })

    it('should rethrow non-duplicate errors', async () => {
      const error = new Error('Database error')
      userService.createUser.mockRejectedValue(error)

      await expect(authService.signup({})).rejects.toThrow('Database error')
    })
  })

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockUser = createMockUser()
      const spy = jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access token',
        refreshToken: 'refresh token',
      })
      const result = await authService.login({
        username: 'testuser',
        password: 'Password@123',
      })

      expect(spy).toHaveBeenCalled()
      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.username).toBe(mockUser.username)
    })

    it('should store refresh token in database', async () => {
      const mockUser = createMockUser()
      jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)

      await authService.login({
        username: 'test',
        password: 'pass',
      })

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(mockUser)
    })

    it('should generate valid tokens', async () => {
      const mockUser = createMockUser()
      jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access token',
        refreshToken: 'refresh token',
      })
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
      await authService.logout('refresh_token')

      expect(tokenService.revokeSession).toHaveBeenCalledWith('refresh_token')
    })

    it('should throw AuthenticationError when refresh token is invalid', async () => {
      tokenService.revokeSession.mockRejectedValue(
        new AuthenticationError('Session not found or already terminated', 'SESSION_NOT_FOUND')
      )

      await expect(authService.logout('invalid_token')).rejects.toThrow(AuthenticationError)
      await expect(authService.logout('invalid_token')).rejects.toThrow(
        'Session not found or already terminated'
      )
    })
  })

  describe('refreshSession', () => {
    it('should refresh tokens successfully', async () => {
      const token = crypto.randomBytes(64).toString('hex')
      const userId = crypto.randomUUID()
      tokenService.getUserId.mockResolvedValue(userId)
      tokenService.rotateTokens.mockResolvedValue({
        accessToken: 'access token',
        refreshToken: 'refresh token',
      })
      const result = await authService.refreshSession(token)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })

    it('should replace old refresh token with new', async () => {
      const user = { id: 'userId', username: 'test', role: 'user' }
      const token = crypto.randomBytes(64).toString('hex')
      tokenService.getUserId.mockResolvedValue()
      userService.findUserById.mockResolvedValue(user)
      tokenService.rotateTokens.mockResolvedValue({
        accessToken: 'access token',
        refreshToken: 'refresh token',
      })
      const result = await authService.refreshSession(token)

      expect(tokenService.rotateTokens).toHaveBeenCalledWith(token, user)
      expect(result.refreshToken).not.toBe(token)
    })
  })
})
