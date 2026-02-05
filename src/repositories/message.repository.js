const { Message } = require('@models')

class MessageRepository {
  create(messageData) {
    return Message.create(messageData)
  }

  findById(messageId) {
    return Message.findById(messageId)
  }

  findByIdWithPopulate(messageId, populateFields) {
    return Message.findById(messageId).populate(populateFields)
  }

  findAll(query, options = {}) {
    const { skip = 0, limit = 50, sort = { createdAt: 1 } } = options
    return Message.find(query).sort(sort).skip(skip).limit(limit)
  }

  findAllWithPopulate(query, options = {}, populateFields) {
    const { skip = 0, limit = 50, sort = { createdAt: 1 } } = options
    return Message.find(query).populate(populateFields).sort(sort).skip(skip).limit(limit)
  }

  countDocuments(query) {
    return Message.countDocuments(query)
  }

  findByIdAndUpdate(messageId, updateData, options = {}) {
    return Message.findByIdAndUpdate(messageId, updateData, { new: true, ...options })
  }

  findByIdAndDelete(messageId) {
    return Message.findByIdAndDelete(messageId)
  }

  updateOne(query, updateData) {
    return Message.updateOne(query, updateData)
  }
}

module.exports = new MessageRepository()
