const crypto = require('crypto')
const chatService = require('@services/chat.service')
const { ConflictError, NotFoundError, AuthorizationError } = require('@errors')
const { createMockChat } = require('@tests/unit/helpers')
const { CHAT_TYPES } = require('@constants')

jest.mock('@repositories')
jest.mock('@config')

const { chatRepository, userRepository } = require('@repositories')

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createChat', () => {
    it('creates a private chat', async () => {
      const userId1 = crypto.randomUUID()
      const userId2 = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.PRIVATE,
        participants: [userId1, userId2],
      })
      userRepository.contains.mockResolvedValue(true)
      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(mockChat)

      const result = await chatService.createChat(
        { participants: [userId2], type: CHAT_TYPES.PRIVATE },
        userId1
      )

      expect(chatRepository.create).toHaveBeenCalled()
      expect(result.type).toBe(CHAT_TYPES.PRIVATE)
    })

    it('creates a group chat with admin set', async () => {
      const adminId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        groupName: 'Test Group',
      })
      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(mockChat)

      const result = await chatService.createChat(
        { participants: [userId], type: CHAT_TYPES.GROUP, groupName: 'Test Group' },
        adminId
      )

      expect(result.type).toBe(CHAT_TYPES.GROUP)
      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ admin: adminId, groupName: 'Test Group' })
      )
    })

    it('automatically adds creator to participants', async () => {
      const creatorId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      userRepository.countDocuments.mockResolvedValue(2)
      chatRepository.create.mockResolvedValue(createMockChat())

      await chatService.createChat({ participants: [userId], type: CHAT_TYPES.PRIVATE }, creatorId)

      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: expect.arrayContaining([creatorId, userId]),
        })
      )
    })
  })

  describe('getUserChats', () => {
    it('returns chats with pagination', async () => {
      const userId = crypto.randomUUID()
      chatRepository.countDocuments.mockResolvedValue(10)
      chatRepository.findAllWithPopulate.mockResolvedValue([createMockChat(), createMockChat()])

      const result = await chatService.getUserChats(userId, { skip: 0, limit: 20 })

      expect(result.chats).toHaveLength(2)
      expect(result.total).toBe(10)
    })

    it('passes type filter to countDocuments', async () => {
      const userId = crypto.randomUUID()
      chatRepository.countDocuments.mockResolvedValue(5)
      chatRepository.findAllWithPopulate.mockResolvedValue([])

      await chatService.getUserChats(userId, { filter: { type: CHAT_TYPES.GROUP } })

      expect(chatRepository.countDocuments).toHaveBeenCalledWith({
        participants: userId,
        type: CHAT_TYPES.GROUP,
      })
    })
  })

  describe('getChatById', () => {
    it('returns the chat for a participant', async () => {
      const chatId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      const mockChat = createMockChat({ _id: chatId, participants: [userId] })
      chatRepository.findById.mockResolvedValue(mockChat)

      const result = await chatService.getChatById(chatId, userId)

      expect(result.id).toEqual(chatId)
    })

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)

      await expect(chatService.getChatById('nonexistent', 'userId')).rejects.toThrow(NotFoundError)
    })

    it('throws AuthorizationError when user is not a participant', async () => {
      const mockChat = createMockChat({ participants: [crypto.randomUUID()] })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(chatService.getChatById('chatId', crypto.randomUUID())).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('updateChat', () => {
    it('updates a group chat as admin', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue({ ...mockChat, groupName: 'Updated Name' })

      const result = await chatService.updateChat(mockChat._id, adminId.toString(), {
        groupName: 'Updated Name',
      })

      expect(result.name).toBe('Updated Name')
    })

    it('throws AuthorizationError when a non-admin tries to update', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, admin: adminId })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.updateChat('chatId', crypto.randomUUID().toString(), { groupName: 'New' })
      ).rejects.toThrow(AuthorizationError)
    })
  })

  describe('deleteChat', () => {
    it('deletes a group chat as admin', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, admin: adminId })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndDelete.mockResolvedValue(mockChat)

      await chatService.deleteChat(mockChat._id, adminId.toString())

      expect(chatRepository.findByIdAndDelete).toHaveBeenCalledWith(mockChat._id)
    })
  })

  describe('addMember', () => {
    it('adds a member to a group chat as admin', async () => {
      const adminId = crypto.randomUUID()
      const newMemberId = crypto.randomUUID()
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
        expect.objectContaining({ $addToSet: { participants: newMemberId.toString() } })
      )
    })

    it('allows a user to add themselves', async () => {
      const userId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [crypto.randomUUID()],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.addMember('chatId', userId.toString(), null)

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalled()
    })

    it('throws ConflictError when member already exists', async () => {
      const adminId = crypto.randomUUID()
      const existingMemberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, existingMemberId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.addMember('chatId', adminId.toString(), existingMemberId.toString())
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('removeMember', () => {
    it('allows a user to remove themselves', async () => {
      const userId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [userId, crypto.randomUUID()],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', userId.toString(), userId.toString())

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalled()
    })

    it('deletes the chat when the last member leaves', async () => {
      const userId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, participants: [userId] })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)
      chatRepository.findByIdAndDelete.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', userId.toString(), userId.toString())

      expect(chatRepository.findByIdAndDelete).toHaveBeenCalled()
    })

    it('throws ConflictError when admin tries to leave without transferring ownership', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, crypto.randomUUID()],
      })
      chatRepository.findById.mockResolvedValue(mockChat)

      await expect(
        chatService.removeMember('chatId', adminId.toString(), adminId.toString())
      ).rejects.toThrow(ConflictError)
    })
  })
})
