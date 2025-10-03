class AppError extends Error {
  constructor(message, status, op = true) {
    super(message)
    this.status = status
    this.timestamp = new Date().toISOString()
    this.operational = op
    Error.captureStackTrace(this, this.constructor)
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation Error', 400)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

class AuthError extends AppError {
  constructor() {
    super('Invalid Credentials', 401)
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
}
