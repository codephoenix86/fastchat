const crypto = require('crypto')
const { accessToken } = require('@middlewares/authentication.middleware')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')
const { AuthenticationError } = require('@errors')
const tokenService = require('@services/token.service')

// Mock dependencies
jest.mock('@repositories', () => ({
  tokenRepository: {
    saveRefreshToken: jest.fn(),
  },
}))
jest.mock('@config', () => ({
  redis: {
    getClient: () => ({
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    }),
  },
  env: {
    ACCESS_TOKEN_SECRET: 'test-secret',
    ACCESS_TOKEN_TTL: '10m',
    REFRESH_TOKEN_TTL: '7d',
  },
}))

describe('Auth Middleware', () => {
  describe('accessToken', () => {
    it('should attach user to request on valid token', async () => {
      const userId = crypto.randomUUID()

      const tokens = await tokenService.issueTokenPair({
        id: userId,
        username: 'testuser',
        role: 'user',
      })
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
      const expiredToken = jwt.sign({ id: 'test' }, env.ACCESS_TOKEN_SECRET, { expiresIn: '0s' })

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
})
