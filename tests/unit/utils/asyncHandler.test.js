const { asyncHandler } = require('@utils')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')

describe('asyncHandler', () => {
  it('calls the wrapped function with req, res, next', async () => {
    const fn = jest.fn((req, res, _) => {
      res.json({ success: true })
      return Promise.resolve()
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    await asyncHandler(fn)(req, res, next)

    expect(fn).toHaveBeenCalledWith(req, res, next)
    expect(res.json).toHaveBeenCalledWith({ success: true })
    expect(next).not.toHaveBeenCalled()
  })

  it('forwards async errors to next', async () => {
    const error = new Error('async error')
    const fn = jest.fn(() => Promise.reject(error))

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    await asyncHandler(fn)(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })

  it('forwards synchronous throws to next', (done) => {
    const error = new Error('sync error')
    const fn = jest.fn(() => {
      throw error
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    asyncHandler(fn)(req, res, next)

    setImmediate(() => {
      expect(next).toHaveBeenCalledWith(error)
      done()
    })
  })
})
