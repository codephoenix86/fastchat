const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const ms = require('ms')
const { env, logger } = require('@config')
const { AuthenticationError } = require('@errors')
const { tokenRepository } = require('@repositories')

class TokenService {
  _generateAccessToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      jti: crypto.randomUUID(),
    }
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
      expiresIn: env.ACCESS_TOKEN_TTL,
    })
  }

  _generateOpaqueToken() {
    return crypto.randomBytes(64).toString('hex')
  }

  async issueTokenPair(user) {
    const accessToken = this._generateAccessToken(user)
    const refreshToken = this._generateOpaqueToken()

    const expires = Math.floor(ms(env.REFRESH_TOKEN_TTL) / 1000)

    // Save the token as the key, and the user's ID as the value
    await tokenRepository.save(refreshToken, user.id, expires)

    return {
      accessToken,
      refreshToken,
    }
  }

  /**
   * Verifies a JWT Access Token and maps errors to domain exceptions
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, env.ACCESS_TOKEN_SECRET)
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

  async getUserId(refreshToken) {
    const storedUserId = await tokenRepository.getUserIdByToken(refreshToken)

    if (!storedUserId) {
      logger.warn('Refresh token not found or expired')
      throw new AuthenticationError(
        'Session expired or invalid. Please log in again.',
        'REFRESH_TOKEN_REVOKED'
      )
    }

    return storedUserId
  }

  async rotateTokens(refreshToken, user) {
    // Burn the old token
    await tokenRepository.delete(refreshToken)

    const tokens = await this.issueTokenPair(user)
    return tokens
  }

  async revokeSession(refreshToken) {
    const storedUserId = await tokenRepository.getUserIdByToken(refreshToken)

    if (!storedUserId) {
      throw new AuthenticationError('Session not found or already terminated', 'SESSION_NOT_FOUND')
    }

    await tokenRepository.delete(refreshToken)
  }
}

module.exports = new TokenService()
