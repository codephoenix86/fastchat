const { StatusCodes } = require('http-status-codes')
const AppError = require('./app.error')
/**
 * Unsupported media type error (415)
 */
class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Invalid file type', code = 'UNSUPPORTED_MEDIA_TYPE') {
    super(message, StatusCodes.UNSUPPORTED_MEDIA_TYPE)
    this.code = code
  }
}

module.exports = UnsupportedMediaTypeError
