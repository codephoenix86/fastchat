const { ValidationError } = require('@errors')
const mongoose = require('mongoose')

/**
 * Validate MongoDB ObjectId parameter
 * @param {String} name - Parameter name for error message
 */
exports.validateId = (name) => (req, res, next, id) => {
  // Skip validation for special keywords like 'me'
  if (id === 'me') {
    return next()
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${name} ID`)
  }
  next()
}
