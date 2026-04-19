const { Server } = require('socket.io')
const { presenceService } = require('@services')
const { env, logger } = require('@config')
const { SOCKET_EVENTS } = require('@constants')
const { authMiddleware } = require('./middlewares')
const {
  registerChatHandlers,
  registerMessageHandlers,
  registerTypingHandlers,
} = require('./handlers')

let io = null
const init = (server) => {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })
  // Apply authentication middleware
  io.use(authMiddleware)
  io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
    const { userId } = socket
    const socketId = socket.id

    logger.info('Socket connected', { socketId, userId })

    registerChatHandlers(io, socket)
    registerMessageHandlers(io, socket)
    registerTypingHandlers(io, socket)

    const isFirstConnection = await presenceService.addSocket(userId, socketId)
    if (isFirstConnection) {
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, { userId })
      logger.debug('User came online', { userId })
    }

    socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
      logger.info('Socket disconnected', { socketId, userId, reason })

      const isLastConnection = await presenceService.removeSocket(userId, socketId)
      if (isLastConnection) {
        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, { userId })
        logger.debug('User went offline', { userId })
      }
    })
  })

  logger.info('Socket.io server initialized')
  return io
}
const ioProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!io) {
        throw new Error('Socket.io server is not initialized')
      }
      if (typeof io[prop] === 'function') {
        return io[prop].bind(io)
      }
      return io[prop]
    },
  }
)
module.exports = {
  init,
  io: ioProxy,
}
