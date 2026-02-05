const EVENTS = require('@sockets/events')
const { logger } = require('@config')

/**
 * Handle chat room events (join/leave)
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
module.exports = (io, socket) => {
  /**
   * User joins a chat room
   */
  socket.on(EVENTS.CHAT_JOIN, (data) => {
    const { chatId } = data

    socket.join(chatId)

    logger.info('User joined chat', {
      socketId: socket.id,
      userId: socket.userId,
      chatId,
    })
  })

  /**
   * User leaves a chat room
   */
  socket.on(EVENTS.CHAT_LEAVE, (data) => {
    const { chatId } = data

    socket.leave(chatId)

    logger.info('User left chat', {
      socketId: socket.id,
      userId: socket.userId,
      chatId,
    })
  })
}
