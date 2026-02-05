const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Authentication error (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Please log in to get access', code = 'UNAUTHORIZED') {
    super(message, StatusCodes.UNAUTHORIZED)
    this.code = code
  }
}

module.exports = AuthenticationError
