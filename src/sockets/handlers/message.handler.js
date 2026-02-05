const { messageService } = require('@services')
const EVENTS = require('@sockets/events')
const { logger } = require('@config')

/**
 * Handle message status events (delivered/read)
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
module.exports = (io, socket) => {
  /**
   * Message delivered to user
   */
  socket.on(EVENTS.MESSAGE_DELIVERED, async (data) => {
    const { messageId } = data

    try {
      await messageService.updateMessageStatus(messageId, 'delivered')

      logger.debug('Message delivered', {
        userId: socket.userId,
        messageId,
        socketId: socket.id,
      })
    } catch (err) {
      logger.error('Error updating message status to delivered:', {
        messageId,
        error: err.message,
        stack: err.stack,
        name: err.name,
        userId: socket.userId,
      })
    }
  })

  /**
   * Message read by user
   */
  socket.on(EVENTS.MESSAGE_READ, async (data) => {
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
  })
}
