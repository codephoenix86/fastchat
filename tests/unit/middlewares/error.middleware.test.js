const { StatusCodes } = require('http-status-codes')

const mockEnv = { NODE_ENV: 'test' }
const mockLogger = { error: jest.fn(), warn: jest.fn() }

jest.mock('@config', () => ({
  env: mockEnv,
  logger: mockLogger,
}))

const handleError = require('@middlewares/error.middleware')
const { ValidationError, AuthorizationError } = require('@errors')

const makeReq = (overrides = {}) => ({
  originalUrl: '/api/test',
  method: 'POST',
  ip: '127.0.0.1',
  user: null,
  id: 'req-123',
  ...overrides,
})

const makeRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('error.middleware — operational errors', () => {
  it('uses the error statusCode', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN)
  })

  it('sets success: false', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].success).toBe(false)
  })

  it('includes error code', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden', 'NOT_ALLOWED'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.code).toBe('NOT_ALLOWED')
  })

  it('includes error message', () => {
    const res = makeRes()
    handleError(new AuthorizationError('You cannot do that'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.message).toBe('You cannot do that')
  })

  it('includes requestId from req.id', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq({ id: 'my-req-id' }), res, jest.fn())
    expect(res.json.mock.calls[0][0].requestId).toBe('my-req-id')
  })

  it('includes timestamp', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].timestamp).toBeDefined()
  })

  it('includes details when err.errors is present', () => {
    const err = new ValidationError('Invalid', 'VALIDATION_FAILED', [
      { path: 'email', message: 'required' },
    ])
    const res = makeRes()
    handleError(err, makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.details).toHaveLength(1)
  })

  it('omits details when err.errors is absent', () => {
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.details).toBeUndefined()
  })
})

describe('error.middleware — non-operational errors', () => {
  it('responds with 500', () => {
    const res = makeRes()
    handleError(new Error('Unexpected crash'), makeReq(), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR)
  })

  it('uses INTERNAL_SERVER_ERROR code', () => {
    const res = makeRes()
    handleError(new Error('Crash'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('exposes the actual message outside production', () => {
    mockEnv.NODE_ENV = 'test'
    const res = makeRes()
    handleError(new Error('Detailed crash info'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.message).toBe('Detailed crash info')
  })

  it('hides the message in production', () => {
    mockEnv.NODE_ENV = 'production'
    const res = makeRes()
    handleError(new Error('Detailed crash info'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].error.message).toBe('Internal server error')
    mockEnv.NODE_ENV = 'test'
  })
})

describe('error.middleware — stack trace', () => {
  it('includes stack in development', () => {
    mockEnv.NODE_ENV = 'development'
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].stack).toBeDefined()
    mockEnv.NODE_ENV = 'test'
  })

  it('omits stack in production', () => {
    mockEnv.NODE_ENV = 'production'
    const res = makeRes()
    handleError(new AuthorizationError('Forbidden'), makeReq(), res, jest.fn())
    expect(res.json.mock.calls[0][0].stack).toBeUndefined()
    mockEnv.NODE_ENV = 'test'
  })
})

describe('error.middleware — logger', () => {
  it('calls logger.warn for operational errors', () => {
    const err = new AuthorizationError('Forbidden')
    const req = makeReq({ originalUrl: '/api/v1/test', method: 'GET', id: 'r1' })
    handleError(err, req, makeRes(), jest.fn())
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({ err, requestId: 'r1', method: 'GET', url: '/api/v1/test' })
    )
  })

  it('calls logger.error for non-operational errors', () => {
    const err = new Error('Unexpected crash')
    const req = makeReq({ id: 'r2' })
    handleError(err, req, makeRes(), jest.fn())
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({ err, requestId: 'r2' })
    )
  })
})
