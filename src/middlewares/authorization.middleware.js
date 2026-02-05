const { AuthorizationError } = require('@errors')

/**
 * Role-based authorization middleware
 * @param {String} role - Required role
 */
exports.role = (role) => (req, res, next) => {
  if (req.user.role !== role) {
    throw new AuthorizationError('Access denied')
  }
  next()
}
