const { tokenService } = require('@services')
const { AuthenticationError } = require('@errors')

/**
 * Verify access token middleware
 */
exports.accessToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const regex = /^Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/

  if (!authHeader) {
    throw new AuthenticationError('Authorization token missing', 'MISSING_TOKEN')
  }

  if (!regex.test(authHeader)) {
    throw new AuthenticationError('Authorization token is malformed', 'INVALID_TOKEN')
  }

  const token = authHeader.split(/\s+/)[1]

  const user = tokenService.verifyAccessToken(token)

  req.user = user
  next()
}

/**
 * Verify refresh token middleware
 */
exports.refreshToken = (req, res, next) => {
  const { refresh_token } = req.body

  if (!refresh_token) {
    throw new AuthenticationError('Refresh token is required', 'MISSING_TOKEN')
  }

  next()
}
