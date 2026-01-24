const chatService = require('../../services/chat.service')
const { ValidationError, NotFoundError, AuthorizationError } = require('../../utils/errors/errors')
const { createMockChat, createObjectId } = require('../helpers')
const { CHAT_TYPES } = require('../../constants')

jest.mock('../../repositories')

const { chatRepository, userRepository } = require('../../repositories')

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createChat', () => {
    it('should create private chat successfully', async () => {
      const userId1 = createObjectId()
      const userId2 = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.PRIVATE,
        participants: [userId1, userId2],
      })

      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(mockChat)

      const result = await chatService.createChat(
        {
          participants: [userId2],
          type: CHAT_TYPES.PRIVATE,
        },
        userId1
      )

      expect(userRepository.countDocuments).toHaveBeenCalled()
      expect(chatRepository.create).toHaveBeenCalled()
      expect(result.type).toBe(CHAT_TYPES.PRIVATE)
    })

    it('should create group chat with admin', async () => {
      const adminId = createObjectId()
      const userId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        groupName: 'Test Group',
      })

      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(mockChat)

      const result = await chatService.createChat(
        {
          participants: [userId],
          type: CHAT_TYPES.GROUP,
          groupName: 'Test Group',
        },
        adminId
      )

      expect(result.type).toBe(CHAT_TYPES.GROUP)
      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          admin: adminId,
          groupName: 'Test Group',
        })
      )
    })

    it('should throw ValidationError when participants do not exist', async () => {
      userRepository.countDocuments.mockResolvedValue(1)

      await expect(
        chatService.createChat(
          {
            participants: [createObjectId(), createObjectId()],
            type: CHAT_TYPES.PRIVATE,
          },
          createObjectId()
        )
      ).rejects.toThrow(ValidationError)
    })

    it('should add creator to participants automatically', async () => {
      const creatorId = createObjectId()
      const userId = createObjectId()

      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(createMockChat())

      await chatService.createChat(
        {
          participants: [userId],
          type: CHAT_TYPES.PRIVATE,
        },
        creatorId
      )

      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: expect.arrayContaining([creatorId, userId]),
        })
      )
    })
  })

  describe('getUserChats', () => {
    it('should return user chats with pagination', async () => {
      const userId = createObjectId()
      const mockChats = [createMockChat(), createMockChat()]

      chatRepository.countDocuments.mockResolvedValue(10)
      chatRepository.findAllWithPopulate.mockResolvedValue(mockChats)

      const result = await chatService.getUserChats(userId, {
        skip: 0,
        limit: 20,
      })

      expect(result.chats).toHaveLength(2)
      expect(result.total).toBe(10)
    })

    it('should apply type filter', async () => {
      const userId = createObjectId()
      chatRepository.countDocuments.mockResolvedValue(5)
      chatRepository.findAllWithPopulate.mockResolvedValue([])

      await chatService.getUserChats(userId, {
        filter: { type: CHAT_TYPES.GROUP },
      })

      expect(chatRepository.countDocuments).toHaveBeenCalledWith({
        participants: userId,
        type: CHAT_TYPES.GROUP,
      })
    })
  })

  describe('getChatById', () => {
    it('should return chat by ID', async () => {
      const chatId = createObjectId()
      const userId = createObjectId()
      const mockChat = createMockChat({
        _id: chatId,
        participants: [{ _id: userId }],
      })

      chatRepository.findByIdWithPopulate.mockResolvedValue(mockChat)

      const result = await chatService.getChatById(chatId, userId)

      expect(result.id).toEqual(chatId)
    })

    it('should throw NotFoundError when chat does not exist', async () => {
      chatRepository.findByIdWithPopulate.mockResolvedValue(null)

      await expect(chatService.getChatById('nonexistent', 'userId')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw AuthorizationError when user is not a participant', async () => {
      const mockChat = createMockChat({
        participants: [{ _id: createObjectId() }],
      })

      chatRepository.findByIdWithPopulate.mockResolvedValue(mockChat)

      await expect(chatService.getChatById('chatId', createObjectId())).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('updateChat', () => {
    it('should update group chat as admin', async () => {
      const adminId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue({
        ...mockChat,
        groupName: 'Updated Name',
      })

      const result = await chatService.updateChat(mockChat._id, adminId.toString(), {
        groupName: 'Updated Name',
      })

      expect(result.name).toBe('Updated Name')
    })

    it('should throw ValidationError for private chat', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(chatService.updateChat('chatId', 'userId', {})).rejects.toThrow(
        ValidationError
      )
    })

    it('should throw AuthorizationError when non-admin tries to update', async () => {
      const adminId = createObjectId()
      const nonAdminId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
      })

      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.updateChat('chatId', nonAdminId.toString(), { groupName: 'New' })
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('deleteChat', () => {
    it('should delete group chat as admin', async () => {
      const adminId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndDelete.mockResolvedValue(mockChat)

      await chatService.deleteChat(mockChat._id, adminId.toString())

      expect(chatRepository.findByIdAndDelete).toHaveBeenCalledWith(mockChat._id)
    })

    it('should throw ValidationError for private chat', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(chatService.deleteChat('chatId', 'userId')).rejects.toThrow(ValidationError)
    })
  })

  describe('addMember', () => {
    it('should add member to group chat as admin', async () => {
      const adminId = createObjectId()
      const newMemberId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.addMember('chatId', adminId.toString(), newMemberId.toString())

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalledWith(
        'chatId',
        expect.objectContaining({
          $addToSet: { participants: newMemberId.toString() },
        })
      )
    })

    it('should allow user to add themselves', async () => {
      const userId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [createObjectId()],
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.addMember('chatId', userId.toString(), null)

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalled()
    })

    it('should throw ValidationError when member already exists', async () => {
      const adminId = createObjectId()
      const existingMemberId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, existingMemberId],
      })

      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.addMember('chatId', adminId.toString(), existingMemberId.toString())
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('removeMember', () => {
    it('should allow user to remove themselves', async () => {
      const userId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [userId, createObjectId()],
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', userId.toString(), userId.toString())

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalled()
    })

    it('should delete chat when last member leaves', async () => {
      const userId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [userId],
      })

      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)
      chatRepository.findByIdAndDelete.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', userId.toString(), userId.toString())

      expect(chatRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('should throw AuthorizationError when admin tries to leave without transfer', async () => {
      const adminId = createObjectId()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, createObjectId()],
      })

      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.removeMember('chatId', adminId.toString(), adminId.toString())
      ).rejects.toThrow(AuthorizationError)
    })
  })
})