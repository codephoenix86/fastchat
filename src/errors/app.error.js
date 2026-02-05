/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message)

    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.isOperational = true
    this.timestamp = new Date().toISOString()

    // Set the name to the class name (e.g., 'AuthError')
    // We make it non-enumerable to match native Error behavior
    Object.defineProperty(this, 'name', {
      value: this.constructor.name,
      enumerable: false,
      configurable: true,
    })

    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = AppError
