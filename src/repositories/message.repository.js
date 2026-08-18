const { Message } = require('@models')
const { MESSAGE_STATUS } = require('@constants')
const userRepository = require('./user.repository')

class MessageRepository {
  async _populateMessages(messages) {
    const userIds = new Set()
    messages.forEach((message) => {
      userIds.add(message.sender)
    })
    const profiles = await userRepository.findProfiles(Array.from(userIds))
    const users = {}
    profiles.forEach((profile) => (users[profile.id] = profile))
    messages.forEach((message) => {
      message.sender = users[message.sender]
    })
    return messages
  }
  async create(messageData) {
    const { content, file, sender, chat } = messageData
    let message = await Message.create({ content, file, sender, chat })
    message = await message.populate('chat')
    message = message.toObject()
    message.chat = {
      id: message.chat._id,
      participants: message.chat.participants,
      type: message.chat.type,
    }
    await this._populateMessages([message])
    return {
      id: message._id,
      content: message.content || undefined,
      file: message.file || undefined,
      sender: message.sender,
      chat: message.chat,
      createdAt: message.createdAt,
    }
  }

  async findById(messageId) {
    const message = await Message.findById(messageId).populate('chat').lean()
    if (!message) {
      return null
    }
    message.chat = {
      id: message.chat._id,
      participants: message.chat.participants,
      type: message.chat.type,
    }
    await this._populateMessages([message])
    return {
      id: message._id,
      content: message.content || undefined,
      file: message.file || undefined,
      sender: message.sender,
      chat: message.chat || undefined,
      createdAt: message.createdAt,
    }
  }

  async findAll(options = {}) {
    const { skip = 0, limit = 50 } = options
    const messages = await Message.find()
      .populate('chat')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
    if (!messages) {
      return null
    }
    await this._populateMessages(messages)
    return messages.map((message) => ({
      id: message._id,
      content: message.content || undefined,
      file: message.file || undefined,
      sender: message.sender,
      createdAt: message.createdAt,
    }))
  }

  async updateById(messageId, updateData) {
    const { content } = updateData
    const message = await Message.findByIdAndUpdate(messageId, { content }, { new: true })
      .populate('chat')
      .lean()
    if (!message) {
      return null
    }
    await this._populateMessages([message])
    return {
      id: message._id,
      content: message.content,
      sender: message.sender,
      createAt: message.createdAt,
    }
  }

  async getChatMessages(chatId, options = {}) {
    const { skip = 0, limit = 50 } = options
    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
    if (!messages) {
      return null
    }
    await this._populateMessages(messages)
    return messages.map((message) => ({
      id: message._id,
      content: message.content || undefined,
      file: message.file || undefined,
      sender: message.sender,
      createdAt: message.createdAt,
    }))
  }

  async updateStatus(chatId, status) {
    const updatedMessages = await Message.updateMany(
      { status: MESSAGE_STATUS.SENT, chat: chatId },
      { $set: { status } }
    )
    await this._populateMessages(updatedMessages)
    return updatedMessages.map((updatedMessage) => ({
      id: updatedMessage._id,
      content: updatedMessage.content,
      status: updatedMessage.status,
      chat: updatedMessage.chat,
      sender: updatedMessage.sender,
      createdAt: updatedMessage.createdAt,
    }))
  }
}

module.exports = new MessageRepository()
