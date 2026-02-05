const { asyncHandler } = require('@utils')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')

describe('AsyncHandler', () => {
  it('should call async function successfully', async () => {
    const asyncFn = jest.fn((req, res) => {
      res.json({ success: true })
      return Promise.resolve()
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    const handler = asyncHandler(asyncFn)
    await handler(req, res, next)

    expect(asyncFn).toHaveBeenCalledWith(req, res, next)
    expect(res.json).toHaveBeenCalledWith({ success: true })
    expect(next).not.toHaveBeenCalled()
  })

  it('should catch errors and pass to next', async () => {
    const error = new Error('Test error')

    const asyncFn = jest.fn(() => Promise.reject(error))

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    const handler = asyncHandler(asyncFn)
    await handler(req, res, next)

    expect(asyncFn).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(error)
  })

  it('should handle synchronous errors', (done) => {
    const error = new Error('Sync error')
    const asyncFn = jest.fn(() => {
      throw error
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    const handler = asyncHandler(asyncFn)
    handler(req, res, next)

    // Use setImmediate to wait for promise to resolve
    setImmediate(() => {
      expect(next).toHaveBeenCalledWith(error)
      done()
    })
  })

  it('should handle rejected promises', async () => {
    const error = new Error('Rejection error')
    const asyncFn = jest.fn(() => Promise.reject(error))

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    const handler = asyncHandler(asyncFn)
    await handler(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })

  it('should pass all arguments to wrapped function', async () => {
    const asyncFn = jest.fn((req, res, next) => {
      expect(req).toBeDefined()
      expect(res).toBeDefined()
      expect(next).toBeDefined()
      return Promise.resolve()
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    const handler = asyncHandler(asyncFn)
    await handler(req, res, next)

    expect(asyncFn).toHaveBeenCalledWith(req, res, next)
  })
})
