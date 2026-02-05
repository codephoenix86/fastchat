const { validateId } = require('@middlewares/param.middleware')
const { ValidationError } = require('@errors')
const { mockRequest, mockResponse, mockNext, createObjectId } = require('@tests/unit/helpers')

describe('Param Middleware', () => {
  describe('validateId', () => {
    it('should call next for valid ObjectId', () => {
      const validId = createObjectId()
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('user')
      middleware(req, res, next, validId)

      expect(next).toHaveBeenCalled()
    })

    it('should skip validation for "me" keyword', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('user')
      middleware(req, res, next, 'me')

      expect(next).toHaveBeenCalled()
    })

    it('should throw ValidationError for invalid ObjectId', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('user')

      expect(() => {
        middleware(req, res, next, 'invalid-id')
      }).toThrow(ValidationError)

      expect(() => {
        middleware(req, res, next, 'invalid-id')
      }).toThrow('Invalid user ID')
    })

    it('should use correct resource name in error message', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('chat')

      try {
        middleware(req, res, next, '123')
      } catch (error) {
        expect(error.message).toBe('Invalid chat ID')
      }
    })

    it('should handle short invalid IDs', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('message')

      expect(() => {
        middleware(req, res, next, '123')
      }).toThrow(ValidationError)
    })

    it('should handle long invalid IDs', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('user')

      expect(() => {
        middleware(req, res, next, 'a'.repeat(50))
      }).toThrow(ValidationError)
    })

    it('should not call next for invalid IDs', () => {
      const req = mockRequest()
      const res = mockResponse()
      const next = mockNext()

      const middleware = validateId('user')

      try {
        middleware(req, res, next, 'invalid')
      } catch (_err) {
        expect(next).not.toHaveBeenCalled()
      }
    })
  })
})
