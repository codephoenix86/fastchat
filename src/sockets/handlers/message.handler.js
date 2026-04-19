const { messageService } = require('@services')
const { SOCKET_EVENTS } = require('@constants')
const { logger } = require('@config')

module.exports = (io, socket) => {
  const updateStatus = async (messageId, status) => {
    try {
      await messageService.updateMessageStatus(messageId, status)
    } catch (err) {
      logger.error('Failed to update message status via socket', {
        messageId,
        status,
        userId: socket.userId,
        err,
      })
    }
  }

  socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, ({ messageId }) =>
    updateStatus(messageId, 'delivered')
  )
  socket.on(SOCKET_EVENTS.MESSAGE_READ, ({ messageId }) => updateStatus(messageId, 'read'))
}
