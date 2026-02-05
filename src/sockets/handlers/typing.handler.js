const EVENTS = require('@sockets/events')
const { logger } = require('@config')

/**
 * Handle typing indicator events
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
module.exports = (io, socket) => {
  /**
   * User started typing in a chat
   */
  socket.on(EVENTS.TYPING_START, (data) => {
    const { chatId } = data

    // Broadcast to all other users in the chat
    socket.to(chatId).emit(EVENTS.TYPING_START, {
      userId: socket.userId,
      chatId,
    })

    logger.debug('User started typing', {
      userId: socket.userId,
      chatId,
      socketId: socket.id,
    })
  })

  /**
   * User stopped typing in a chat
   */
  socket.on(EVENTS.TYPING_STOP, (data) => {
    const { chatId } = data

    // Broadcast to all other users in the chat
    socket.to(chatId).emit(EVENTS.TYPING_STOP, {
      userId: socket.userId,
      chatId,
    })

    logger.debug('User stopped typing', {
      userId: socket.userId,
      chatId,
      socketId: socket.id,
    })
  })
}
