const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Not found error (404)
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, StatusCodes.NOT_FOUND)
    this.code = code
  }
}

module.exports = NotFoundError
