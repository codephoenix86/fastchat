const { logger } = require('@config')
const { AuthenticationError } = require('@errors')
const { tokenService } = require('@services')

/**
 * Socket.io authentication middleware
 * Verifies JWT token from socket handshake and attaches userId to socket
 */
const authenticate = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.token

    if (!token) {
      logger.warn('Socket connection rejected: missing token', {
        socketId: socket.id,
        address: socket.handshake.address,
      })
      return next(new AuthenticationError('Authorization token missing', 'MISSING_TOKEN'))
    }

    const user = tokenService.verifyAccessToken(token)
    socket.userId = user.id
    next()
  } catch (err) {
    logger.warn('Socket connection rejected: invalid token', {
      socketId: socket.id,
      err,
    })
    next(new Error(err.message))
  }
}

module.exports = authenticate
