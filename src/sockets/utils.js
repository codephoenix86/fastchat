const { messageService } = require('@services')
const { logger } = require('@config')

/**
 * Push pending messages to newly connected user
 * @param {Object} socket - Socket.io socket instance
 * @param {String} userId - User ID
 */
exports.pushPendingMessages = async (socket, userId) => {
  try {
    const messages = await messageService.getPendingMessages(userId)

    messages.forEach((message) => {
      socket.emit('message:new', {
        id: message.id,
        content: message.content,
        sender: message.sender,
        chatId: message.chat,
        status: message.status,
        createdAt: message.createdAt,
      })
    })

    logger.info('Pushed pending messages', {
      userId,
      count: messages.length,
    })
  } catch (err) {
    logger.error('Error pushing pending messages:', {
      userId,
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
  }
}
