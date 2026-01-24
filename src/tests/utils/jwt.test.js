const jwt = require('jsonwebtoken')
const { generateTokens, verifyToken } = require('../../utils/auth/jwt')
const { AuthError } = require('../../utils/errors/errors')
const { env } = require('../../config')

describe('JWT Utilities', () => {
  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' }
      const tokens = generateTokens(payload)

      expect(tokens).toHaveProperty('accessToken')
      expect(tokens).toHaveProperty('refreshToken')
      expect(typeof tokens.accessToken).toBe('string')
      expect(typeof tokens.refreshToken).toBe('string')
    })

    it('should generate valid JWT tokens', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' }
      const tokens = generateTokens(payload)

      const accessDecoded = jwt.verify(tokens.accessToken, env.JWT_SECRET)
      const refreshDecoded = jwt.verify(tokens.refreshToken, env.JWT_REFRESH_SECRET)

      expect(accessDecoded.id).toBe(payload.id)
      expect(refreshDecoded.id).toBe(payload.id)
    })

    it('should set correct expiration times', () => {
      const payload = { id: 'user123' }
      const tokens = generateTokens(payload)

      const accessDecoded = jwt.verify(tokens.accessToken, env.JWT_SECRET)
      const refreshDecoded = jwt.verify(tokens.refreshToken, env.JWT_REFRESH_SECRET)

      expect(accessDecoded.exp).toBeDefined()
      expect(refreshDecoded.exp).toBeDefined()
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const payload = { id: 'user123', username: 'testuser' }
      const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' })

      const decoded = verifyToken(token, env.JWT_SECRET)

      expect(decoded.id).toBe(payload.id)
      expect(decoded.username).toBe(payload.username)
    })

    it('should throw AuthError for invalid token', () => {
      expect(() => {
        verifyToken('invalid.token.here', env.JWT_SECRET)
      }).toThrow(AuthError)
    })

    it('should throw AuthError for expired token', () => {
      const token = jwt.sign({ id: 'user123' }, env.JWT_SECRET, { expiresIn: '-1s' })

      expect(() => {
        verifyToken(token, env.JWT_SECRET)
      }).toThrow(AuthError)
    })

    it('should throw AuthError for token with wrong secret', () => {
      const token = jwt.sign({ id: 'user123' }, 'wrong_secret')

      expect(() => {
        verifyToken(token, env.JWT_SECRET)
      }).toThrow(AuthError)
    })

    it('should throw AuthError with appropriate message for JsonWebTokenError', () => {
      expect(() => {
        verifyToken('malformed', env.JWT_SECRET)
      }).toThrow('Invalid token')
    })

    it('should throw AuthError with appropriate message for TokenExpiredError', () => {
      const token = jwt.sign({ id: 'user123' }, env.JWT_SECRET, { expiresIn: '0s' })

      expect(() => {
        verifyToken(token, env.JWT_SECRET)
      }).toThrow('Token expired')
    })
  })
})