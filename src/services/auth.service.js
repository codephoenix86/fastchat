const bcrypt = require('bcrypt')

const userService = require('./user.service')
const tokenService = require('./token.service')
const { logger } = require('@config')

const { AuthenticationError } = require('@errors')

class AuthService {
  async signup(userData) {
    const { email, username, password } = userData
    const password_hash = await bcrypt.hash(password, 10)
    const user = await userService.create({ email, username, password_hash })

    logger.info('User registered', { userId: user.id })

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    }
  }

  async authenticate(identifier, password) {
    const user = await userService.findByIdentifier(identifier, true)
    if (!user) {
      // Log without identifier to avoid leaking PII/usernames in logs.
      logger.warn('Login failed: user not found')
      throw new AuthenticationError('Invalid email/username or password', 'INVALID_CREDENTIALS')
    }
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      logger.warn('Login failed: incorrect password', { userId: user.id })
      throw new AuthenticationError('Invalid email/username or password', 'INVALID_CREDENTIALS')
    }
    return user
  }

  async login(credentials) {
    const { email, username, password } = credentials
    const identifier = email || username

    const user = await this.authenticate(identifier, password)
    const tokens = await tokenService.issueTokenPair(user)

    logger.info('User logged in', { userId: user.id })

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    }
  }

  async logout(refreshToken) {
    await tokenService.revokeSession(refreshToken)
  }

  async refreshSession(refreshToken) {
    const userId = await tokenService.getUserId(refreshToken)

    const user = await userService.findById(userId)

    const tokens = await tokenService.rotateTokens(refreshToken, user)

    return tokens
  }
}

module.exports = new AuthService()
