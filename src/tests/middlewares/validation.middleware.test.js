const validate = require('../../middlewares/validation.middleware')
const { validationResult } = require('express-validator')
const { ValidationError } = require('../../utils/errors/errors')
const { mockRequest, mockResponse, mockNext } = require('../helpers')

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
        msg: 'Email is required',
        path: 'email',
        location: 'body',
      },
      {
        msg: 'Password is too short',
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
      expect(error.message).toBe('Validation failed')
      expect(error.errors).toEqual([
        {
          message: 'Email is required',
          field: 'email',
          location: 'body',
        },
        {
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
          msg: 'Username is invalid',
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
        message: 'Username is invalid',
        field: 'username',
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