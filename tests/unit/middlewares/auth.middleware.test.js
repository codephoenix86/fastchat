const { accessToken, refreshToken } = require('@middlewares/auth.middleware')
const { mockRequest, mockResponse, mockNext, createObjectId } = require('@tests/unit/helpers')
const { AuthenticationError } = require('@errors')
const {
  jwt: { generateTokens },
} = require('@utils')

// Mock dependencies
jest.mock('@repositories', () => ({
  refreshTokenRepository: {
    exists: jest.fn(),
  },
}))

const { refreshTokenRepository } = require('@repositories')

describe('Auth Middleware', () => {
  describe('accessToken', () => {
    it('should attach user to request on valid token', () => {
      const userId = createObjectId()
      const tokens = generateTokens({ id: userId, username: 'test', role: 'user' })

      const req = mockRequest({
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      })
      const res = mockResponse()
      const next = mockNext()

      accessToken(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.id).toBe(userId)
      expect(next).toHaveBeenCalled()
    })

    it('should throw AuthenticationError when token is missing', () => {
      const req = mockRequest({ headers: {} })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthenticationError)
      expect(() => {
        accessToken(req, res, next)
      }).toThrow('Authorization token missing')
    })

    it('should throw AuthenticationError when authorization header is malformed', () => {
      const req = mockRequest({
        headers: { authorization: 'InvalidFormat' },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError when token is invalid', () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid.token.here' },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthenticationError)
    })

    it('should throw AuthenticationError when token is expired', () => {
      const jwt = require('jsonwebtoken')
      const { env } = require('@config')
      const expiredToken = jwt.sign({ id: 'test' }, env.JWT_SECRET, { expiresIn: '0s' })

      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthenticationError)
    })
  })

  describe('refresh_token', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should attach user to request on valid refresh token', async () => {
      const userId = createObjectId()
      const tokens = generateTokens({ id: userId, username: 'test', role: 'user' })

      refreshTokenRepository.exists.mockResolvedValue(true)

      const req = mockRequest({
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { refresh_token: tokens.refreshToken },
      })
      const res = mockResponse()
      const next = mockNext()

      await refreshToken(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.id).toBe(userId)
      expect(refreshTokenRepository.exists).toHaveBeenCalledWith({
        user: userId,
        refreshToken: tokens.refreshToken,
      })
      expect(next).toHaveBeenCalled()
    })

    it('should throw AuthenticationError when token does not exist in database', async () => {
      const tokens = generateTokens({ id: 'test', username: 'test', role: 'user' })
      refreshTokenRepository.exists.mockResolvedValue(null)

      const req = mockRequest({
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { refresh_token: tokens.refreshToken },
      })
      const res = mockResponse()
      const next = mockNext()

      await expect(refreshToken(req, res, next)).rejects.toThrow(AuthenticationError)
      await expect(refreshToken(req, res, next)).rejects.toThrow(
        'Your session has expired. Please log in again.'
      )
    })

    it('should throw AuthenticationError when token is invalid', async () => {
      const req = mockRequest({
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { refresh_token: 'invalid.token.here' },
      })
      const res = mockResponse()
      const next = mockNext()

      await expect(refreshToken(req, res, next)).rejects.toThrow(AuthenticationError)
    })
  })
})
