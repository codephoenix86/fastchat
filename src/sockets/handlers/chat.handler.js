/**
 * Handle chat room events (join/leave)
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
const { SOCKET_EVENTS } = require('@constants')
const { logger } = require('@config')
module.exports = (io, socket) => {
  const joinChat = (data) => {
    const { chatId } = data
    socket.join(chatId)
    logger.info('User joined chat', {
      socketId: socket.id,
      userId: socket.userId,
      chatId,
    })
  }
  const leaveChat = (data) => {
    const { chatId } = data
    socket.leave(chatId)
    logger.info('User left chat', {
      socketId: socket.id,
      userId: socket.userId,
      chatId,
    })
  }
  // User joins a chat room
  socket.on(SOCKET_EVENTS.CHAT_JOIN, joinChat)
  // User leaves a chat room
  socket.on(SOCKET_EVENTS.CHAT_LEAVE, leaveChat)
}
