const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Authorization error (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(message, StatusCodes.FORBIDDEN)
    this.code = code
  }
}

module.exports = AuthorizationError
