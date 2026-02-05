const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Payload too large error (413)
 */
class PayloadTooLargeError extends AppError {
  constructor(message = 'File size is too large', code = 'PAYLOAD_TOO_LARGE') {
    super(message, StatusCodes.REQUEST_TOO_LONG)
    this.code = code
  }
}

module.exports = PayloadTooLargeError
