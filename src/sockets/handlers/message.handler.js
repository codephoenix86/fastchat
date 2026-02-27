/**
 * Handle message status events (delivered/read)
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
const { messageService } = require('@services')
const { SOCKET_EVENTS } = require('@constants')
const { logger } = require('@config')
module.exports = (io, socket) => {
  const setMessageStatusToDelivered = async (data) => {
    const { messageId } = data
    try {
      await messageService.updateMessageStatus(messageId, 'delivered')
      logger.debug('Message delivered', {
        userId: socket.userId,
        messageId,
        socketId: socket.id,
      })
    } catch (err) {
      logger.error('Error updating message status to delivered', {
        messageId,
        error: err.message,
        stack: err.stack,
        name: err.name,
        userId: socket.userId,
      })
    }
  }
  const setMessageStatusToRead = async (data) => {
    const { messageId } = data
    try {
      await messageService.updateMessageStatus(messageId, 'read')
      logger.debug('Message read', {
        userId: socket.userId,
        messageId,
        socketId: socket.id,
      })
    } catch (err) {
      logger.error('Error updating message status to read:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        messageId,
        userId: socket.userId,
      })
    }
  }
  // Message delivered to user
  socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, setMessageStatusToDelivered)
  // Message read by user
  socket.on(SOCKET_EVENTS.MESSAGE_READ, setMessageStatusToRead)
}
