/**
 * Handle typing indicator events
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
const { SOCKET_EVENTS } = require('@constants')
const { logger } = require('@config')
module.exports = (io, socket) => {
  const handleStartTyping = (data) => {
    const { chatId } = data
    // Broadcast to all other users in the chat
    socket.to(chatId).emit(SOCKET_EVENTS.TYPING_START, {
      userId: socket.userId,
      chatId,
    })
    logger.debug('User started typing', {
      userId: socket.userId,
      chatId,
      socketId: socket.id,
    })
  }
  const handleStopTyping = (data) => {
    const { chatId } = data
    // Broadcast to all other users in the chat
    socket.to(chatId).emit(SOCKET_EVENTS.TYPING_STOP, {
      userId: socket.userId,
      chatId,
    })
    logger.debug('User stopped typing', {
      userId: socket.userId,
      chatId,
      socketId: socket.id,
    })
  }
  // User started typing in a chat
  socket.on(SOCKET_EVENTS.TYPING_START, handleStartTyping)
  // User stopped typing in a chat
  socket.on(SOCKET_EVENTS.TYPING_STOP, handleStopTyping)
}
