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
jest.mock('@config/redis', () => ({
  getClient: () => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }),
}))
jest.mock('@services/token.service')

const bcrypt = require('bcrypt')

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('signup', () => {
    it('creates and returns a new user without password_hash', async () => {
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

    it('throws ConflictError for a duplicate email', async () => {
      userService.createUser.mockRejectedValue(
        new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
      )

      await expect(authService.signup({ email: 'existing@example.com' })).rejects.toThrow(
        ConflictError
      )
    })

    it('throws ConflictError for a duplicate username', async () => {
      userService.createUser.mockRejectedValue(
        new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
      )

      await expect(authService.signup({ username: 'existing' })).rejects.toThrow(ConflictError)
    })

    it('rethrows unexpected errors', async () => {
      userService.createUser.mockRejectedValue(new Error('Database error'))

      await expect(authService.signup({})).rejects.toThrow('Database error')
    })
  })

  describe('login', () => {
    it('returns user, accessToken, and refreshToken on success', async () => {
      const mockUser = createMockUser()
      jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      })

      const result = await authService.login({ username: 'testuser', password: 'Password@123' })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.username).toBe(mockUser.username)
    })

    it('calls tokenService.issueTokenPair with the authenticated user', async () => {
      const mockUser = createMockUser()
      jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)

      await authService.login({ username: 'test', password: 'pass' })

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(mockUser)
    })

    it('returns distinct access and refresh tokens', async () => {
      const mockUser = createMockUser()
      jest.spyOn(authService, 'authenticate').mockResolvedValue(mockUser)
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      })

      const result = await authService.login({ username: 'test', password: 'pass' })

      expect(typeof result.accessToken).toBe('string')
      expect(typeof result.refreshToken).toBe('string')
      expect(result.accessToken).not.toBe(result.refreshToken)
    })
  })

  describe('logout', () => {
    it('calls tokenService.revokeSession with the refresh token', async () => {
      await authService.logout('refresh_token')

      expect(tokenService.revokeSession).toHaveBeenCalledWith('refresh_token')
    })

    it('throws AuthenticationError for an invalid refresh token', async () => {
      tokenService.revokeSession.mockRejectedValue(
        new AuthenticationError('Session not found or already terminated', 'SESSION_NOT_FOUND')
      )

      await expect(authService.logout('invalid_token')).rejects.toThrow(AuthenticationError)
    })
  })

  describe('refreshSession', () => {
    it('returns a new access and refresh token pair', async () => {
      const token = crypto.randomBytes(64).toString('hex')
      tokenService.getUserId.mockResolvedValue(crypto.randomUUID())
      tokenService.rotateTokens.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      })

      const result = await authService.refreshSession(token)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })

    it('calls rotateTokens with the old token and the resolved user', async () => {
      const user = { id: 'userId', username: 'test', role: 'user' }
      const token = crypto.randomBytes(64).toString('hex')
      tokenService.getUserId.mockResolvedValue(undefined)
      userService.findUserById.mockResolvedValue(user)
      tokenService.rotateTokens.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      })

      const result = await authService.refreshSession(token)

      expect(tokenService.rotateTokens).toHaveBeenCalledWith(token, user)
      expect(result.refreshToken).not.toBe(token)
    })
  })
})
