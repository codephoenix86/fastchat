const { Chat } = require('@models')
const userRepository = require('./user.repository')
const { CHAT_TYPES } = require('@constants')

class ChatRepository {
  _buildChatKey(participantIds) {
    return participantIds.sort().join(':')
  }
  async _populateParticipants(chats) {
    const participantIds = new Set()
    chats.forEach((chat) => {
      chat.participants.forEach((participant) => participantIds.add(participant))
      if (chat.admin) {
        participantIds.add(chat.admin)
      }
    })
    const participants = {}
    const profiles = await userRepository.findProfiles(Array.from(participantIds))
    profiles.forEach((profile) => (participants[profile.id] = profile))
    chats.forEach((chat) => {
      chat.participants = chat.participants.map((participant) => participants[participant])
      if (chat.admin) {
        chat.admin = participants[chat.admin]
      }
    })
    return chats
  }
  async create(chatData) {
    const { type, groupName, groupPicture, participants, admin } = chatData
    const chatKey = this._buildChatKey(participants)
    let chat = await Chat.create({
      type,
      ...(type === CHAT_TYPES.PRIVATE && { chatKey }),
      groupName,
      groupPicture,
      participants,
      admin,
    })
    if (!chat) {
      return null
    }
    chat = chat.toObject()
    await this._populateParticipants([chat])
    return {
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      admin: chat.admin || undefined,
    }
  }

  async findById(chatId) {
    const chat = await Chat.findById(chatId).lean()
    if (!chat) {
      return null
    }
    await this._populateParticipants([chat])
    return {
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      admin: chat.admin || undefined,
    }
  }

  async findAll(options = {}) {
    const { skip = 0, limit = 20 } = options
    const chats = await Chat.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      admin: chat.admin || undefined,
    }))
  }
  async updateGroupById(chatId, updateData) {
    const { groupName, groupPicture, admin } = updateData
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { groupName, groupPicture, admin },
      { new: true }
    ).lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      groupName: updatedChat.groupName || undefined,
      groupPicture: updatedChat.groupPicture || undefined,
      participants: updatedChat.participants || undefined,
      admin: updatedChat.admin || undefined,
    }
  }

  async addMember(chatId, userId) {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { participants: userId } },
      { new: true }
    ).lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      participants: updatedChat.participants,
      groupPicture: updatedChat.groupPicture || undefined,
      groupName: updatedChat.groupName || undefined,
      admin: updatedChat.admin || undefined,
    }
  }

  async removeMember(chatId, userId) {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { participants: userId } },
      { new: true }
    ).lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      participants: updatedChat.participants,
      groupPicture: updatedChat.groupPicture || undefined,
      groupName: updatedChat.groupName || undefined,
      admin: updatedChat.admin || undefined,
    }
  }

  async exists(chatId) {
    const isChatExist = await Chat.exists({ _id: chatId })
    return isChatExist
  }

  async createByUpsert(participants) {
    const chatKey = this._buildChatKey(participants)
    const chat = await Chat.findOneAndUpdate(
      { chatKey },
      { $setOnInsert: { type: CHAT_TYPES.PRIVATE, chatKey, participants } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()
    await this._populateParticipants([chat])
    return {
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
    }
  }

  async getUserChats(userId, options = {}) {
    const { skip = 0, limit = 20 } = options
    const chats = await Chat.find({ participants: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      participants: chat.participants,
      admin: chat.admin || undefined,
    }))
  }

  async deleteGroupById(chatId) {
    await Chat.findByIdAndDelete(chatId)
  }

  async getAllUserChats(userId) {
    const chats = await Chat.find({ participants: userId }).sort({ createdAt: -1 }).lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      participants: chat.participants,
      admin: chat.admin || undefined,
    }))
  }
}

module.exports = new ChatRepository()
