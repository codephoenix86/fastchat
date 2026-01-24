const { accessToken, refreshToken } = require('../../middlewares/auth.middleware')
const { mockRequest, mockResponse, mockNext, createObjectId } = require('../helpers')
const { ValidationError, AuthError } = require('../../utils/errors/errors')
const { generateTokens } = require('../../utils/auth/jwt')

// Mock dependencies
jest.mock('../../repositories', () => ({
  refreshTokenRepository: {
    exists: jest.fn(),
  },
}))

const { refreshTokenRepository } = require('../../repositories')

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

    it('should throw ValidationError when token is missing', () => {
      const req = mockRequest({ headers: {} })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(ValidationError)
      expect(() => {
        accessToken(req, res, next)
      }).toThrow('Authorization token missing or malformed')
    })

    it('should throw ValidationError when authorization header is malformed', () => {
      const req = mockRequest({
        headers: { authorization: 'InvalidFormat' },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(ValidationError)
    })

    it('should throw AuthError when token is invalid', () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid.token.here' },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthError)
    })

    it('should throw AuthError when token is expired', () => {
      const jwt = require('jsonwebtoken')
      const { env } = require('../../config')
      const expiredToken = jwt.sign({ id: 'test' }, env.JWT_SECRET, { expiresIn: '0s' })

      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      })
      const res = mockResponse()
      const next = mockNext()

      expect(() => {
        accessToken(req, res, next)
      }).toThrow(AuthError)
    })
  })

  describe('refreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should attach user to request on valid refresh token', async () => {
      const userId = createObjectId()
      const tokens = generateTokens({ id: userId, username: 'test', role: 'user' })

      refreshTokenRepository.exists.mockResolvedValue(true)

      const req = mockRequest({
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

    it('should throw ValidationError when refresh_token is missing', async () => {
      const req = mockRequest({ body: {} })
      const res = mockResponse()
      const next = mockNext()

      await expect(refreshToken(req, res, next)).rejects.toThrow(ValidationError)
      await expect(refreshToken(req, res, next)).rejects.toThrow('refresh_token is required')
    })

    it('should throw AuthError when token does not exist in database', async () => {
      const tokens = generateTokens({ id: 'test', username: 'test', role: 'user' })
      refreshTokenRepository.exists.mockResolvedValue(null)

      const req = mockRequest({
        body: { refresh_token: tokens.refreshToken },
      })
      const res = mockResponse()
      const next = mockNext()

      await expect(refreshToken(req, res, next)).rejects.toThrow(AuthError)
      await expect(refreshToken(req, res, next)).rejects.toThrow('Invalid refresh token')
    })

    it('should throw AuthError when token is invalid', async () => {
      const req = mockRequest({
        body: { refresh_token: 'invalid.token.here' },
      })
      const res = mockResponse()
      const next = mockNext()

      await expect(refreshToken(req, res, next)).rejects.toThrow(AuthError)
    })
  })
})