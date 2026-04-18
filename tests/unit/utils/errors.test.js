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

describe('AppError', () => {
  it('sets message, statusCode, isOperational, and timestamp', () => {
    const error = new AppError('Test error', 500)

    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
    expect(error.timestamp).toBeDefined()
  })

  it('is an instance of Error', () => {
    expect(new AppError('Test', 500)).toBeInstanceOf(Error)
  })

  it('captures a stack trace', () => {
    expect(new AppError('Test', 500).stack).toBeDefined()
  })
})

describe('ValidationError', () => {
  it('defaults to 400 BAD_REQUEST', () => {
    const error = new ValidationError('Invalid input')

    expect(error.message).toBe('Invalid input')
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST)
    expect(error.code).toBe('BAD_REQUEST')
  })

  it('accepts an error details array', () => {
    const errors = [{ path: 'body.email', message: 'Invalid email' }]
    const error = new ValidationError('Invalid request data', 'VALIDATION_FAILED', errors)

    expect(error.errors).toEqual(errors)
  })
})

describe('AuthenticationError', () => {
  it('defaults to 401 UNAUTHORIZED', () => {
    const error = new AuthenticationError('Unauthorized')

    expect(error.message).toBe('Unauthorized')
    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED)
    expect(error.code).toBe('UNAUTHORIZED')
  })
})

describe('NotFoundError', () => {
  it('defaults to 404 NOT_FOUND', () => {
    const error = new NotFoundError('Resource not found')

    expect(error.message).toBe('Resource not found')
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND)
    expect(error.code).toBe('NOT_FOUND')
  })
})

describe('AuthorizationError', () => {
  it('defaults to 403 FORBIDDEN', () => {
    const error = new AuthorizationError('Forbidden')

    expect(error.message).toBe('Forbidden')
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN)
    expect(error.code).toBe('FORBIDDEN')
  })
})

describe('ConflictError', () => {
  it('defaults to 409 CONFLICT', () => {
    const error = new ConflictError('Resource already exists')

    expect(error.message).toBe('Resource already exists')
    expect(error.statusCode).toBe(StatusCodes.CONFLICT)
    expect(error.code).toBe('CONFLICT')
  })
})

describe('RateLimitError', () => {
  it('defaults to 429 with standard message', () => {
    const error = new RateLimitError()

    expect(error.message).toBe('Too many requests, please try again later')
    expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS)
    expect(error.code).toBe('TOO_MANY_REQUESTS')
  })

  it('accepts a custom message', () => {
    expect(new RateLimitError('Custom rate limit message').message).toBe(
      'Custom rate limit message'
    )
  })
})

describe('PayloadTooLargeError', () => {
  it('defaults to 413 PAYLOAD_TOO_LARGE', () => {
    const error = new PayloadTooLargeError()

    expect(error.message).toBe('File size is too large')
    expect(error.statusCode).toBe(StatusCodes.REQUEST_TOO_LONG)
    expect(error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('accepts a custom message', () => {
    expect(new PayloadTooLargeError('Upload exceeds limit').message).toBe('Upload exceeds limit')
  })
})
