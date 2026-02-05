const jwt = require('jsonwebtoken')

const { AuthenticationError } = require('@errors')
const { env } = require('@config')

/**
 * Generate access and refresh tokens
 * @param {Object} payload - User data to encode in token
 * @returns {Object} - { accessToken, refreshToken }
 */
exports.generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  })

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  })

  return { accessToken, refreshToken }
}

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @param {String} secret - Secret key
 * @returns {Object} - Decoded payload
 */
exports.verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret)
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'SyntaxError') {
      throw new AuthenticationError(
        'The provided safety token is invalid or has been tampered with',
        'INVALID_TOKEN'
      )
    }
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError(
        'Your session has expired. Please log in again',
        'TOKEN_EXPIRED'
      )
    }
    if (err.name === 'NotBeforeError') {
      throw new AuthenticationError('This token is not yet valid for use', 'TOKEN_NOT_ACTIVE')
    }
    throw new AuthenticationError(
      'We could not verify your identity. Please try again',
      'AUTHENTICATION_FAILED'
    )
  }
}
