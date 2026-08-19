const { chatRepository } = require('@repositories')
const userService = require('./user.service')
const { CHAT_TYPES } = require('@constants')
const { logger } = require('@config')
const { NotFoundError, AuthorizationError, ConflictError, ValidationError } = require('@errors')

class ChatService {
  async createGroupChat(chatData, creatorId) {
    const { participants, groupName } = chatData

    participants.push(creatorId)

    const isAllUsersPresent = await userService.existAll(participants)
    if (!isAllUsersPresent) {
      throw new ValidationError(
        'One or more selected participants does not exist',
        'USER_NOT_FOUND'
      )
    }

    const chat = await chatRepository.create({
      type: CHAT_TYPES.GROUP,
      groupName,
      admin: creatorId,
      participants,
    })

    logger.info('Chat created', { chatId: chat.id, type: CHAT_TYPES.GROUP, creatorId })

    return chat
  }

  async createPrivateChat(senderId, peerId) {
    if (senderId === peerId) {
      throw new ValidationError('Cannot start a chat with yourself', 'INVALID_PEER')
    }

    const peerExists = await userService.existAll([peerId])
    if (!peerExists) {
      throw new ValidationError('Peer user does not exist', 'USER_NOT_FOUND')
    }

    const chat = await chatRepository.createByUpsert([senderId, peerId])

    return chat
  }

  async getUserChats(userId, options = {}) {
    const userExists = await userService.existAll([userId])
    if (!userExists) {
      throw new NotFoundError('User not found')
    }

    const chats = await chatRepository.getUserChats(userId, options)

    return {
      chats,
      total: chats.length,
    }
  }

  async getChatById(chatId, userId) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    // Verify user is a participant
    if (!chat.participants.some((p) => p.user.id === userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    return chat
  }

  async updateGroup(chatId, userId, updateData) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    if (chat.type === CHAT_TYPES.PRIVATE) {
      throw new ValidationError('Cannot update private chat', 'INVALID_CHAT_TYPE')
    }

    // Only admin can update chat
    if (chat.admin.id !== userId) {
      throw new AuthorizationError('Only the admin can update chat', 'ADMIN_REQUIRED')
    }

    if (
      updateData.admin &&
      !chat.participants.some((participant) => participant.user.id === updateData.admin)
    ) {
      throw new ValidationError('New admin must be a member of the group', 'NOT_A_MEMBER')
    }
    const updatedChat = await chatRepository.updateGroupById(chatId, updateData)

    logger.info('Chat updated', { chatId, userId })

    return {
      id: updatedChat._id,
      type: updatedChat.type,
      groupName: updatedChat.groupName || undefined,
      groupPicture: updatedChat.groupPicture || undefined,
      participants: updatedChat.participants || undefined,
      admin: updatedChat.admin || undefined,
    }
  }

  async addMember(chatId, userId, newMemberId = null) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    const isUserExists = await userService.existAll([userId])

    if (!isUserExists) {
      throw new NotFoundError('User does not exist')
    }

    if (chat.type === CHAT_TYPES.PRIVATE) {
      throw new ValidationError('Cannot add members to private chat', 'INVALID_CHAT_TYPE')
    }

    // If adding someone else, must be admin
    if (newMemberId && chat.admin.id !== userId) {
      throw new AuthorizationError('Only admin can add other members', 'ADMIN_REQUIRED')
    }

    if (chat.participants.some((participant) => participant.user.id === newMemberId)) {
      throw new ConflictError('User is already a member of this group', 'ALREADY_MEMBER')
    }

    const updatedChat = await chatRepository.addMember(chatId, newMemberId)

    logger.info('Member added to chat', { chatId, memberId: newMemberId })
    return updatedChat
  }

  async removeMember(chatId, userId, memberIdToRemove) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    const isUserExists = await userService.existAll([userId])

    if (!isUserExists) {
      throw new NotFoundError('User does not exist')
    }

    if (chat.type === CHAT_TYPES.PRIVATE) {
      throw new ValidationError('Cannot remove members from private chat', 'INVALID_CHAT_TYPE')
    }

    // Can remove self or admin can remove others
    const isSelf = memberIdToRemove === userId
    const isAdmin = chat.admin && chat.admin.id === userId

    if (!isSelf && !isAdmin) {
      throw new AuthorizationError('Only admin can remove other members', 'ADMIN_REQUIRED')
    }

    // Admin cannot be removed unless they're the last member OR transferring ownership
    if (chat.admin && chat.admin.id === memberIdToRemove && chat.participants.length > 1) {
      throw new ConflictError(
        'Admin must transfer ownership before leaving',
        'ADMIN_TRANSFER_REQUIRED'
      )
    }

    if (!chat.participants.some((participant) => participant.user.id === memberIdToRemove)) {
      throw new ValidationError('User is not a member of this group', 'MEMBER_NOT_FOUND')
    }

    const updatedChat = await chatRepository.removeMember(chatId, memberIdToRemove)

    if (chat.participants.length === 1) {
      await chatRepository.deleteGroupById(chatId)
      logger.info('Empty group auto-deleted', { chatId })
    }

    logger.info('Member removed from chat', { chatId, memberId: memberIdToRemove })
    return updatedChat
  }

  async getMembers(chatId, userId) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    if (!chat.participants.some((participant) => participant.user.id === userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    const members = chat.participants
    return members
  }

  async deleteGroup(chatId, userId) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    if (!chat.participants.some((participant) => participant.user.id === userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    if (chat.participants.length > 1) {
      throw new ConflictError('Chat has more than one participants', 'SINGLE_MEMBER_REQUIRED')
    }

    await chatRepository.deleteGroupById(chatId)
  }

  async updateLastMessage(chat, userId, message) {
    if (!chat.participants.some((p) => p.user.id === userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }
    const updatedChat = await chatRepository.updateLastMessage(chat, message)
    return updatedChat
  }

  async markAsRead(chatId, userId, sequenceId) {
    const chat = await chatRepository.findById(chatId)

    if (!chat) {
      throw new NotFoundError('Chat not found')
    }

    if (!chat.participants.some((participant) => participant.user.id === userId)) {
      throw new AuthorizationError('You are not a member of this chat', 'NOT_A_MEMBER')
    }

    const updatedChat = await chatRepository.markAsRead(chatId, userId, sequenceId)
    return updatedChat
  }
}

module.exports = new ChatService()
