const crypto = require('crypto')
const { accessToken } = require('@middlewares/authentication.middleware')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')
const { AuthenticationError } = require('@errors')
const tokenService = require('@services/token.service')

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

describe('authentication.middleware — accessToken', () => {
  it('attaches user to request for a valid token', async () => {
    const userId = crypto.randomUUID()
    const { accessToken: token } = await tokenService.issueTokenPair({
      id: userId,
      username: 'testuser',
      role: 'user',
    })
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const next = mockNext()

    accessToken(req, mockResponse(), next)

    expect(req.user).toBeDefined()
    expect(req.user.id).toBe(userId)
    expect(next).toHaveBeenCalled()
  })

  it('throws AuthenticationError when token is missing', () => {
    const req = mockRequest({ headers: {} })
    expect(() => accessToken(req, mockResponse(), mockNext())).toThrow(AuthenticationError)
    expect(() => accessToken(req, mockResponse(), mockNext())).toThrow(
      'Authorization token missing'
    )
  })

  it('throws AuthenticationError for a malformed authorization header', () => {
    const req = mockRequest({ headers: { authorization: 'InvalidFormat' } })
    expect(() => accessToken(req, mockResponse(), mockNext())).toThrow(AuthenticationError)
  })

  it('throws AuthenticationError for an invalid token', () => {
    const req = mockRequest({ headers: { authorization: 'Bearer invalid.token.here' } })
    expect(() => accessToken(req, mockResponse(), mockNext())).toThrow(AuthenticationError)
  })

  it('throws AuthenticationError for an expired token', () => {
    const jwt = require('jsonwebtoken')
    const { env } = require('@config')
    const expiredToken = jwt.sign({ id: 'test' }, env.ACCESS_TOKEN_SECRET, { expiresIn: '0s' })
    const req = mockRequest({ headers: { authorization: `Bearer ${expiredToken}` } })

    expect(() => accessToken(req, mockResponse(), mockNext())).toThrow(AuthenticationError)
  })
})
