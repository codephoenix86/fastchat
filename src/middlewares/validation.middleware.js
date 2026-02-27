/**
 * Express middleware to validate request data using Joi schemas.
 * * @param {Object} schema - The Joi schema object (e.g., authSchema.signup)
 * @returns {Function} Express middleware function
 */
const { ValidationError } = require('@errors')

const validate = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(
    {
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body,
    },
    {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    }
  )

  if (error) {
    const errors = []
    const paths = new Set()

    error.details.forEach((detail) => {
      const path = detail.path.join('.')
      const message = detail.message
      if (!paths.has(path)) {
        paths.add(path)
        errors.push({ path, message })
      }
    })

    throw new ValidationError('Invalid request data', 'VALIDATION_FAILED', errors)
  }

  req.headers = value.headers || req.headers
  req.params = value.params || req.params
  req.query = value.query || req.query
  req.body = value.body || req.body

  next()
}

module.exports = validate
