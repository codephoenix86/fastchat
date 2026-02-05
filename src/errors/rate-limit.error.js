const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Rate limit error (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later', code = 'TOO_MANY_REQUESTS') {
    super(message, StatusCodes.TOO_MANY_REQUESTS)
    this.code = code
  }
}

module.exports = RateLimitError
