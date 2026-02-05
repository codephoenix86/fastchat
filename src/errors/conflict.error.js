const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Conflict error (409)
 */
class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, StatusCodes.CONFLICT)
    this.code = code
  }
}

module.exports = ConflictError
