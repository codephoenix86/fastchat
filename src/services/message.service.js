const { messageRepository, chatRepository } = require('@repositories')
const { MESSAGE_STATUS } = require('@constants')
const { logger } = require('@config')
const { NotFoundError, AuthorizationError } = require('@errors')

class MessageService {
  async sendMessage(messageData, senderId) {
    const { content, chatId } = messageData

    // Verify chat exists
    const chat = await chatRepository.findById(chatId)
    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    // Verify sender is a participant
    if (!chat.participants.includes(senderId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    const message = await messageRepository.create({
      content,
      sender: senderId,
      chat: chatId,
      status: MESSAGE_STATUS.SENT,
    })

    logger.info('Message sent', {
      messageId: message._id,
      chatId,
      senderId,
    })

    return this.formatMessage(message)
  }

  async getChatMessages(chatId, userId, options = {}) {
    const { skip = 0, limit = 50, sort = { createdAt: 1 } } = options

    // Verify chat exists and user is a participant
    const chat = await chatRepository.findById(chatId)
    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    if (!chat.participants.includes(userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    // Get total count
    const total = await messageRepository.countDocuments({ chat: chatId })

    // Get messages with pagination
    const populateFields = { path: 'sender', select: 'username avatar' }
    const messages = await messageRepository.findAllWithPopulate(
      { chat: chatId },
      { skip, limit, sort },
      populateFields
    )

    return {
      messages: messages.map((message) => this.formatMessage(message)),
      total,
    }
  }

  async getMessageById(messageId, userId) {
    const populateFields = { path: 'sender', select: 'username avatar' }
    const message = await messageRepository.findByIdWithPopulate(messageId, populateFields)

    if (!message) {
      throw new NotFoundError('Message not found')
    }

    // Verify user is a participant of the chat
    const chat = await chatRepository.findById(message.chat)
    if (!chat || !chat.participants.includes(userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    return this.formatMessage(message)
  }

  async updateMessage(messageId, userId, content) {
    const message = await messageRepository.findById(messageId)

    if (!message) {
      throw new NotFoundError('Message not found')
    }

    // Only sender can edit message
    if (message.sender.toString() !== userId) {
      throw new AuthorizationError('Only the author can modify this message', 'NOT_MESSAGE_OWNER')
    }

    message.content = content
    await message.save()

    logger.info('Message updated', { messageId, userId })

    return this.formatMessage(message)
  }

  async deleteMessage(messageId, userId) {
    const message = await messageRepository.findById(messageId)

    if (!message) {
      throw new NotFoundError('Message not found')
    }

    // Only sender can delete message
    if (message.sender.toString() !== userId) {
      throw new AuthorizationError('Only the author can delete this message', 'NOT_MESSAGE_OWNER')
    }

    await messageRepository.findByIdAndDelete(messageId)

    logger.info('Message deleted', { messageId, userId })
  }

  async updateMessageStatus(messageId, status) {
    const message = await messageRepository.findByIdAndUpdate(messageId, { status })

    if (!message) {
      throw new NotFoundError('Message not found')
    }

    logger.debug('Message status updated', { messageId, status })
    return this.formatMessage(message)
  }

  async getPendingMessages(userId) {
    // Get all chats user is part of
    const chats = await chatRepository.findAll({ participants: userId }, {})
    const chatIds = chats.map((chat) => chat._id)

    // Get all messages that are still in 'sent' status
    const populateFields = { path: 'sender', select: 'username avatar' }
    const messages = await messageRepository.findAllWithPopulate(
      {
        chat: { $in: chatIds },
        status: MESSAGE_STATUS.SENT,
      },
      { sort: { createdAt: 1 } },
      populateFields
    )

    return messages.map((message) => this.formatMessage(message))
  }

  formatMessage(message) {
    if (!message) {
      return null
    }

    return {
      id: message._id,
      content: message.content,
      sender: message.sender,
      chat: message.chat,
      status: message.status,
      type: message.type,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    }
  }
}

module.exports = new MessageService()
