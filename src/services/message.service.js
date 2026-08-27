const { messageRepository } = require('@repositories')
const { MESSAGE_STATUS } = require('@constants')
const { logger } = require('@config')
const { NotFoundError, AuthorizationError } = require('@errors')
const chatService = require('./chat.service')

class MessageService {
  async sendMessage(messageData) {
    const { content, chatId, senderId, file } = messageData

    // Verify chat exists
    const chat = await chatService.getChatById(chatId, senderId)

    const message = await messageRepository.create({
      content,
      file,
      sender: senderId,
      chat: chat.id,
      status: MESSAGE_STATUS.SENT,
    })

    const updatedChat = await chatService.updateLastMessage(chat, senderId, message)

    return { chat: updatedChat, message }
  }

  async sendDirectMessage({ senderId, peerId }, messageData) {
    const { content, file } = messageData

    const chat = await chatService.createPrivateChat(senderId, peerId)
    const message = await messageRepository.create({
      content,
      file,
      sender: senderId,
      chat: chat.id,
      status: MESSAGE_STATUS.SENT,
    })

    const updatedChat = await chatService.updateLastMessage(chat, senderId, message)

    return { chat: updatedChat, message }
  }

  async getChatMessages(chatId, userId, options = {}) {
    const { cursor, limit } = options
    const messages = await messageRepository.getChatMessages(chatId, userId, {
      cursor,
      limit: limit ? limit + 1 : undefined,
    })

    if (!messages) {
      throw new NotFoundError('Messages not found')
    }

    const hasNextPage = messages.length > limit
    if (hasNextPage) {
      messages.pop()
    }

    let nextCursor = null
    if (messages.length > 0) {
      nextCursor = messages[messages.length - 1].createdAt
    }

    messages.reverse()
    return {
      messages,
      hasNextPage,
      nextCursor,
    }
  }

  async getMessageById(messageId, userId) {
    const message = await messageRepository.findById(messageId)
    if (!message) {
      throw new NotFoundError('Message not found')
    }
    const chat = await chatService.getChatById(message.chat.id, userId)
    if (message.chat.id !== chat.id) {
      throw new NotFoundError('Message not found')
    }
    return message
  }

  async updateMessage(messageId, userId, content) {
    const message = await messageRepository.findById(messageId)
    if (!message) {
      throw new NotFoundError('Message not found')
    }
    const chat = await chatService.getChatById(message.chat.id, userId)
    if (message.chat.id !== chat.id) {
      throw new NotFoundError('Message not found')
    }
    // Only sender can edit message
    if (message.sender.id !== userId) {
      throw new AuthorizationError('Only the author can modify this message', 'NOT_MESSAGE_OWNER')
    }
    const updatedMessage = await messageRepository.updateById(messageId, { content })
    return updatedMessage
  }

  async updateMessageStatus(chatId, status) {
    const updatedMessage = await messageRepository.updateStatus(chatId, status)
    logger.debug('Message status updated', { chatId, status })
    return updatedMessage
  }
}

module.exports = new MessageService()
