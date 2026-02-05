const bcrypt = require('bcrypt')
const { userRepository } = require('@repositories')
const { AuthenticationError } = require('@errors')
const { logger } = require('@config')

/**
 * Verify user credentials
 * @param {Object} credentials - { email?, username?, password }
 * @returns {Object} - User document
 */
exports.verifyCredentials = async ({ email, username, password }) => {
  const query = {}
  if (username) {
    query.username = username
  } else if (email) {
    query.email = email
  }

  const user = await userRepository.findOneWithPassword(query)

  if (!user) {
    logger.warn('Login attempt with invalid credentials', { email, username })
    throw new AuthenticationError('Invalid email/username or password', 'INVALID_CREDENTIALS')
  }

  const match = await bcrypt.compare(password, user.password)

  if (!match) {
    logger.warn('Login attempt with incorrect password', {
      userId: user._id,
    })
    throw new AuthenticationError('Invalid email/username or password', 'INVALID_CREDENTIALS')
  }

  return user
}
