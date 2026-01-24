const {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  PayloadTooLargeError,
} = require('../../utils/errors/errors')
const { HTTP_STATUS } = require('../../constants')

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with message and status', () => {
      const error = new AppError('Test error', 500)

      expect(error.message).toBe('Test error')
      expect(error.status).toBe(500)
      expect(error.operational).toBe(true)
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

    it('should allow setting operational to false', () => {
      const error = new AppError('Test', 500, false)

      expect(error.operational).toBe(false)
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with default status', () => {
      const error = new ValidationError('Invalid input')

      expect(error.message).toBe('Invalid input')
      expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST)
      expect(error.name).toBe('VALIDATION_ERROR')
    })

    it('should accept error details array', () => {
      const details = [{ field: 'email', message: 'Invalid email' }]
      const error = new ValidationError('Validation failed', details)

      expect(error.errors).toEqual(details)
    })

    it('should allow custom status code', () => {
      const error = new ValidationError('Custom validation', undefined, 422)

      expect(error.status).toBe(422)
    })
  })

  describe('AuthError', () => {
    it('should create auth error with 401 status', () => {
      const error = new AuthError('Unauthorized')

      expect(error.message).toBe('Unauthorized')
      expect(error.status).toBe(HTTP_STATUS.UNAUTHORIZED)
      expect(error.name).toBe('AUTHENTICATION_ERROR')
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found')

      expect(error.message).toBe('Resource not found')
      expect(error.status).toBe(HTTP_STATUS.NOT_FOUND)
      expect(error.name).toBe('NOT_FOUND')
    })

    it('should allow custom status code', () => {
      const error = new NotFoundError('Not found', 410)

      expect(error.status).toBe(410)
    })
  })

  describe('AuthorizationError', () => {
    it('should create authorization error with 403 status', () => {
      const error = new AuthorizationError('Forbidden')

      expect(error.message).toBe('Forbidden')
      expect(error.status).toBe(HTTP_STATUS.FORBIDDEN)
      expect(error.name).toBe('FORBIDDEN')
    })
  })

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists')

      expect(error.message).toBe('Resource already exists')
      expect(error.status).toBe(HTTP_STATUS.CONFLICT)
      expect(error.name).toBe('CONFLICT')
    })
  })

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError()

      expect(error.message).toBe('Too many requests')
      expect(error.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS)
      expect(error.name).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should accept custom message', () => {
      const error = new RateLimitError('Custom rate limit message')

      expect(error.message).toBe('Custom rate limit message')
    })
  })

  describe('PayloadTooLargeError', () => {
    it('should create payload too large error with 413 status', () => {
      const error = new PayloadTooLargeError()

      expect(error.message).toBe('File too large')
      expect(error.status).toBe(HTTP_STATUS.PAYLOAD_TOO_LARGE)
      expect(error.name).toBe('PAYLOAD_TOO_LARGE')
    })

    it('should accept custom message', () => {
      const error = new PayloadTooLargeError('Upload exceeds limit')

      expect(error.message).toBe('Upload exceeds limit')
    })
  })
})