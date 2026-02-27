const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Validation error (400)
 */
class ValidationError extends AppError {
  constructor(message, code = 'BAD_REQUEST', errors = undefined) {
    super(message, StatusCodes.BAD_REQUEST)
    this.code = code
    this.errors = errors
  }
}

module.exports = ValidationError
