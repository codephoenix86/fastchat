const { validationResult } = require('express-validator')
const { ValidationError } = require('@errors')

/**
 * Validate request based on express-validator rules
 */
module.exports = (req, res, next) => {
  const errorList = validationResult(req)

  if (!errorList.isEmpty()) {
    const errors = errorList.array().map((err) => {
      const details = err.msg
      return {
        field: err.path,
        message: details.text,
        code: details.code,
        expected: details.expected,
        location: err.location,
      }
    })

    throw new ValidationError('Invalid request data', errors, 'VALIDATION_FAILED')
  }

  next()
}
