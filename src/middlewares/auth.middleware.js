const {
  jwt: { verifyToken },
} = require('@utils')
const { refreshTokenRepository } = require('@repositories')
const { env, logger } = require('@config')
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

  const payload = verifyToken(token, env.JWT_SECRET)
  req.user = payload
  next()
}

/**
 * Verify refresh token middleware
 */
exports.refreshToken = async (req, res, next) => {
  const { refresh_token } = req.body

  const user = verifyToken(refresh_token, env.JWT_REFRESH_SECRET)

  const tokenDoc = await refreshTokenRepository.exists({
    user: user.id,
    refreshToken: refresh_token,
  })

  if (!tokenDoc) {
    logger.warn('Refresh token not found in database - potential reuse attempt', {
      userId: user.id,
    })
    throw new AuthenticationError(
      'Your session has expired. Please log in again.',
      'REFRESH_TOKEN_REVOKED'
    )
  }

  req.user = user
  next()
}
