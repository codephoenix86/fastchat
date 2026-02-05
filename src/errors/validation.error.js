const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Validation error (400)
 */
class ValidationError extends AppError {
  constructor(message, errors = undefined, code = 'BAD_REQUEST') {
    super(message, StatusCodes.BAD_REQUEST)
    this.code = code
    this.errors = errors
  }
}

module.exports = ValidationError
