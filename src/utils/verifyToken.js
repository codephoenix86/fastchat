const jwt = require('jsonwebtoken')
const { AuthError } = require('../utils/errors')

module.exports = (token, secret) => {
  try {
    return jwt.verify(token, secret)
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'SyntaxError')
      throw new AuthError('invalid token')
    if (err.name === 'TokenExpiredError') throw new AuthError('token expired')
    if (err.name === 'NotBeforeError')
      throw new AuthError('token is not active yet')
    throw new AuthError('authentication failed')
  }
}
