const { validationResult } = require('express-validator')
const validate = require('@middlewares/validation.middleware')
const { ValidationError } = require('@errors')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')

jest.mock('express-validator')

describe('Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call next when validation passes', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    validate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('should throw ValidationError when validation fails', () => {
    const errors = [
      {
        msg: { text: 'Email is required', code: 'REQUIRED_FIELD', expected: 'email' },
        path: 'email',
        location: 'body',
      },
      {
        msg: { text: 'Password is too short', code: 'TOO_SHORT', expected: 'min:8_chars' },
        path: 'password',
        location: 'body',
      },
    ]

    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => errors,
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    expect(() => {
      validate(req, res, next)
    }).toThrow(ValidationError)

    try {
      validate(req, res, next)
    } catch (error) {
      expect(error.message).toBe('Invalid request data')
      expect(error.errors).toEqual([
        {
          code: 'REQUIRED_FIELD',
          expected: 'email',
          message: 'Email is required',
          field: 'email',
          location: 'body',
        },
        {
          code: 'TOO_SHORT',
          expected: 'min:8_chars',
          message: 'Password is too short',
          field: 'password',
          location: 'body',
        },
      ])
    }
  })

  it('should format errors correctly', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        {
          msg: {
            text: 'Invalid username format',
            code: 'TYPE_MISMATCH',
            expected: 'string',
          },
          path: 'username',
          location: 'body',
        },
      ],
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    try {
      validate(req, res, next)
    } catch (error) {
      expect(error.errors[0]).toEqual({
        field: 'username',
        message: 'Invalid username format',
        code: 'TYPE_MISMATCH',
        expected: 'string',
        location: 'body',
      })
    }
  })

  it('should not call next when validation fails', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Error', path: 'field', location: 'body' }],
    })

    const req = mockRequest()
    const res = mockResponse()
    const next = mockNext()

    expect(() => {
      validate(req, res, next)
    }).toThrow()

    expect(next).not.toHaveBeenCalled()
  })
})
