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
      chat.participants.forEach((participant) => {
        participantIds.add(participant.user)
      })
      if (chat.admin) {
        participantIds.add(chat.admin)
      }
    })
    const participants = {}
    const profiles = await userRepository.findProfiles(Array.from(participantIds))
    profiles.forEach((profile) => (participants[profile.id] = profile))
    chats.forEach((chat) => {
      chat.participants = chat.participants.map((participant) => ({
        ...participant,
        user: participants[participant.user],
      }))
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
      participants: participants.map((pId) => ({
        user: pId,
      })),
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
      lastReadSequence: chat.lastReadSequence,
    }
  }

  async findById(chatId) {
    const chat = await Chat.findById(chatId).populate('lastMessage').lean()
    if (!chat) {
      return null
    }
    await this._populateParticipants([chat])
    const lastMessage = chat.lastMessage
    if (lastMessage) {
      chat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    return {
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      admin: chat.admin || undefined,
      lastMessage: chat.lastMessage || undefined,
      lastReadSequence: chat.lastReadSequence,
    }
  }

  async findAll(options = {}) {
    const { skip = 0, limit = 20 } = options
    const chats = await Chat.find()
      .sort({ createdAt: -1 })
      .populate('lastMessage')
      .skip(skip)
      .limit(limit)
      .lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    chats.forEach((chat) => {
      const lastMessage = chat.lastMessage
      if (lastMessage) {
        chat.lastMessage = {
          id: lastMessage._id,
          content: lastMessage.content,
          status: lastMessage.status,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt,
        }
      }
    })
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      admin: chat.admin || undefined,
      lastMessage: chat.lastMessage || undefined,
      lastReadSequence: chat.lastReadSequence,
    }))
  }
  async updateGroupById(chatId, updateData) {
    const { groupName, groupPicture, admin } = updateData
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { groupName, groupPicture, admin },
      { new: true }
    )
      .populate('lastMessage')
      .lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    const lastMessage = updatedChat.lastMessage
    if (lastMessage) {
      updatedChat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      groupName: updatedChat.groupName || undefined,
      groupPicture: updatedChat.groupPicture || undefined,
      participants: updatedChat.participants || undefined,
      admin: updatedChat.admin || undefined,
      lastMessage: updatedChat.lastMessage || undefined,
      lastReadSequence: updatedChat.lastReadSequence,
    }
  }

  async addMember(chatId, userId) {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { participants: userId } },
      { new: true }
    )
      .populate('lastMessage')
      .lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    const lastMessage = updatedChat.lastMessage
    if (lastMessage) {
      updatedChat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      participants: updatedChat.participants,
      groupPicture: updatedChat.groupPicture || undefined,
      groupName: updatedChat.groupName || undefined,
      admin: updatedChat.admin || undefined,
      lastMessage: updatedChat.lastMessage || undefined,
      lastReadSequence: updatedChat.lastReadSequence,
    }
  }

  async removeMember(chatId, userId) {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { participants: userId } },
      { new: true }
    )
      .populate('lastMessage')
      .lean()
    if (!updatedChat) {
      return null
    }
    await this._populateParticipants([updatedChat])
    const lastMessage = updatedChat.lastMessage
    if (lastMessage) {
      updatedChat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      participants: updatedChat.participants,
      groupPicture: updatedChat.groupPicture || undefined,
      groupName: updatedChat.groupName || undefined,
      admin: updatedChat.admin || undefined,
      lastMessage: updatedChat.lastMessage || undefined,
      lastReadSequence: updatedChat.lastReadSequence,
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
      {
        $setOnInsert: {
          type: CHAT_TYPES.PRIVATE,
          chatKey,
          participants: participants.map((pId) => ({ user: pId })),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('lastMessage')
      .lean()
    await this._populateParticipants([chat])
    const lastMessage = chat.lastMessage
    if (lastMessage) {
      chat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    return {
      id: chat._id,
      type: chat.type,
      participants: chat.participants,
      lastMessage: chat.lastMessage || undefined,
      lastReadSequence: chat.lastReadSequence,
    }
  }

  async getUserChats(userId, options = {}) {
    const { skip, limit } = options
    const chats = await Chat.find({ 'participants.user': userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lastMessage')
      .lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    chats.forEach((chat) => {
      const lastMessage = chat.lastMessage
      if (lastMessage) {
        chat.lastMessage = {
          id: lastMessage._id,
          content: lastMessage.content,
          status: lastMessage.status,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt,
        }
      }
    })
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      participants: chat.participants,
      admin: chat.admin || undefined,
      lastMessage: chat.lastMessage || undefined,
      lastReadSequence: chat.lastReadSequence,
    }))
  }

  async deleteGroupById(chatId) {
    await Chat.findByIdAndDelete(chatId)
  }

  async getAllUserChats(userId) {
    const chats = await Chat.find({ participants: userId })
      .sort({ createdAt: -1 })
      .populate('lastMessage')
      .lean()
    if (!chats) {
      return null
    }
    await this._populateParticipants(chats)
    chats.forEach((chat) => {
      const lastMessage = chat.lastMessage
      if (lastMessage) {
        chat.lastMessage = {
          id: lastMessage._id,
          content: lastMessage.content,
          status: lastMessage.status,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt,
        }
      }
    })
    return chats.map((chat) => ({
      id: chat._id,
      type: chat.type,
      groupName: chat.groupName || undefined,
      groupPicture: chat.groupPicture || undefined,
      participants: chat.participants,
      admin: chat.admin || undefined,
      lastMessage: chat.lastMessage || undefined,
      lastReadSequence: chat.lastReadSequence,
    }))
  }

  async updateLastMessage(chat, message) {
    const updatedChat = await Chat.findOneAndUpdate(
      {
        _id: chat.id,
        $or: [{ lastMessageAt: { $lt: message.createdAt } }, { lastMessageAt: null }],
        'participants.user': message.sender.id,
      },
      [
        {
          $set: {
            lastMessage: message.id,
            lastMessageAt: message.createdAt,
            lastReadSequence: { $add: [{ $ifNull: ['$lastReadSequence', 0] }, 1] },
          },
        },
        {
          $set: {
            participants: {
              $map: {
                input: '$participants',
                as: 'p',
                in: {
                  $cond: {
                    if: { $eq: ['$$p.user', message.sender.id] },
                    // Set latestSequence to the newly incremented lastReadSequence for the sender
                    then: { $mergeObjects: ['$$p', { latestSequence: '$lastReadSequence' }] },
                    // Leave other participants unchanged
                    else: '$$p',
                  },
                },
              },
            },
          },
        },
      ],
      { new: true }
    )
      .populate('lastMessage')
      .lean()
    if (!updatedChat) {
      return null
    }
    const lastMessage = updatedChat.lastMessage
    if (lastMessage) {
      updatedChat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    await this._populateParticipants([updatedChat])
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      groupName: updatedChat.groupName || undefined,
      groupPicture: updatedChat.groupPicture || undefined,
      participants: updatedChat.participants,
      admin: updatedChat.admin || undefined,
      lastMessage: updatedChat.lastMessage || undefined,
      lastReadSequence: updatedChat.lastReadSequence,
    }
  }

  async markAsRead(chatId, userId, sequenceId) {
    const updatedChat = await Chat.findOneAndUpdate(
      { _id: chatId, 'participants.user': userId },
      { $max: { 'participants.$.latestSequence': sequenceId } },
      { new: true }
    )
      .populate('lastMessage')
      .lean()
    if (!updatedChat) {
      return null
    }
    const lastMessage = updatedChat.lastMessage
    if (lastMessage) {
      updatedChat.lastMessage = {
        id: lastMessage._id,
        content: lastMessage.content,
        status: lastMessage.status,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt,
      }
    }
    await this._populateParticipants([updatedChat])
    return {
      id: updatedChat._id,
      type: updatedChat.type,
      groupName: updatedChat.groupName || undefined,
      groupPicture: updatedChat.groupPicture || undefined,
      participants: updatedChat.participants,
      admin: updatedChat.admin || undefined,
      lastMessage: updatedChat.lastMessage || undefined,
      lastReadSequence: updatedChat.lastReadSequence,
    }
  }
}

module.exports = new ChatRepository()
