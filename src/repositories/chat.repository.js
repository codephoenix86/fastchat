const { Chat } = require('@models')

class ChatRepository {
  create(chatData) {
    return Chat.create(chatData)
  }

  findById(chatId) {
    return Chat.findById(chatId)
  }

  findByIdWithPopulate(chatId, populateFields) {
    return Chat.findById(chatId).populate(populateFields)
  }

  findAll(query, options = {}) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 } } = options
    return Chat.find(query).sort(sort).skip(skip).limit(limit)
  }

  findAllWithPopulate(query, options = {}, populateFields) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 } } = options
    return Chat.find(query).sort(sort).skip(skip).limit(limit).populate(populateFields)
  }

  countDocuments(query) {
    return Chat.countDocuments(query)
  }

  findByIdAndUpdate(chatId, updateData, options = {}) {
    return Chat.findByIdAndUpdate(chatId, updateData, { new: true, ...options })
  }

  findByIdAndDelete(chatId) {
    return Chat.findByIdAndDelete(chatId)
  }

  exists(query) {
    return Chat.exists(query)
  }
}

module.exports = new ChatRepository()
