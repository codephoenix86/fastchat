const { Server } = require('socket.io')
const { userRepository } = require('@repositories')
const { pushPendingMessages } = require('./utils')
const onlineUsersService = require('./services/online-users.service')
const { authenticate } = require('./middlewares/auth.middleware')
const { chatHandler, messageHandler, typingHandler } = require('./handlers')
const EVENTS = require('./events')
const { logger, env } = require('@config')

let io = undefined

/**
 * Initialize Socket.io server with all handlers and middleware
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.io server instance
 */
exports.init = (server) => {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Apply authentication middleware
  io.use(authenticate)

  // Handle new connections
  io.on(EVENTS.CONNECTION, async (socket) => {
    const userId = socket.userId

    logger.info('New socket connected', {
      socketId: socket.id,
      userId,
    })

    // Register all event handlers
    chatHandler(io, socket)
    messageHandler(io, socket)
    typingHandler(io, socket)

    // Add socket to online users
    const isFirstConnection = onlineUsersService.addSocket(userId, socket.id)

    // If this is the user's first connection
    if (isFirstConnection) {
      // Broadcast user online status
      socket.broadcast.emit(EVENTS.USER_ONLINE, { userId })

      // Push pending messages to user
      await pushPendingMessages(socket, userId)

      logger.info('User came online', {
        userId,
        socketId: socket.id,
      })
    }

    // Handle disconnect
    socket.on(EVENTS.DISCONNECT, async (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId,
        reason,
      })

      // Remove socket from online users
      const isLastConnection = onlineUsersService.removeSocket(userId, socket.id)

      // If user has no more active sockets
      if (isLastConnection) {
        // Update last seen in database
        await userRepository.findByIdAndUpdate(userId, { lastSeen: Date.now() })

        // Broadcast user offline status
        socket.broadcast.emit(EVENTS.USER_OFFLINE, { userId })

        logger.info('User went offline', {
          userId,
          socketId: socket.id,
        })
      }
    })
  })

  logger.info('Socket.io server initialized')
  return io
}

/**
 * Get Socket.io server instance
 * @returns {Object} - Socket.io server instance
 * @throws {Error} - If Socket.io is not initialized
 */
exports.get = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call init() first.')
  }
  return io
}
