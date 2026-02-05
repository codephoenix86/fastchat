const {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  PayloadTooLargeError,
} = require('@errors')
const { StatusCodes } = require('http-status-codes')

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with message and status', () => {
      const error = new AppError('Test error', 500)

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(true)
      expect(error.timestamp).toBeDefined()
    })

    it('should be an instance of Error', () => {
      const error = new AppError('Test', 500)

      expect(error instanceof Error).toBe(true)
    })

    it('should capture stack trace', () => {
      const error = new AppError('Test', 500)

      expect(error.stack).toBeDefined()
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with default status', () => {
      const error = new ValidationError('Invalid input')

      expect(error.message).toBe('Invalid input')
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST)
      expect(error.code).toBe('BAD_REQUEST')
    })

    it('should accept error details array', () => {
      const details = [{ field: 'email', message: 'Invalid email' }]
      const error = new ValidationError('Validation failed', details)

      expect(error.errors).toEqual(details)
    })
  })

  describe('AuthenticationError', () => {
    it('should create auth error with 401 status', () => {
      const error = new AuthenticationError('Unauthorized')

      expect(error.message).toBe('Unauthorized')
      expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED)
      expect(error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found')

      expect(error.message).toBe('Resource not found')
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND)
      expect(error.code).toBe('NOT_FOUND')
    })
  })

  describe('AuthorizationError', () => {
    it('should create authorization error with 403 status', () => {
      const error = new AuthorizationError('Forbidden')

      expect(error.message).toBe('Forbidden')
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN)
      expect(error.code).toBe('FORBIDDEN')
    })
  })

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists')

      expect(error.message).toBe('Resource already exists')
      expect(error.statusCode).toBe(StatusCodes.CONFLICT)
      expect(error.code).toBe('CONFLICT')
    })
  })

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError()

      expect(error.message).toBe('Too many requests, please try again later')
      expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS)
      expect(error.code).toBe('TOO_MANY_REQUESTS')
    })

    it('should accept custom message', () => {
      const error = new RateLimitError('Custom rate limit message')

      expect(error.message).toBe('Custom rate limit message')
    })
  })

  describe('PayloadTooLargeError', () => {
    it('should create payload too large error with 413 status', () => {
      const error = new PayloadTooLargeError()

      expect(error.message).toBe('File size is too large')
      expect(error.statusCode).toBe(StatusCodes.REQUEST_TOO_LONG)
      expect(error.code).toBe('PAYLOAD_TOO_LARGE')
    })

    it('should accept custom message', () => {
      const error = new PayloadTooLargeError('Upload exceeds limit')

      expect(error.message).toBe('Upload exceeds limit')
    })
  })
})
