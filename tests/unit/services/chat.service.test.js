const crypto = require('crypto')
const chatService = require('@services/chat.service')
const { ConflictError, NotFoundError, AuthorizationError, ValidationError } = require('@errors')
const { createMockChat, createMockUser: _createMockUser } = require('@tests/unit/helpers')
const { CHAT_TYPES } = require('@constants')

jest.mock('@repositories')
jest.mock('@config')

const { chatRepository, userRepository } = require('@repositories')

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─── createChat ───────────────────────────────────────────────────────────

  describe('createChat', () => {
    it('creates a private chat', async () => {
      const userId1 = crypto.randomUUID()
      const userId2 = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.PRIVATE,
        participants: [userId1, userId2],
      })
      userRepository.contains.mockResolvedValue(true)
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
      userRepository.contains.mockResolvedValue(true)
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

    it('does not set admin for private chats', async () => {
      const userId1 = crypto.randomUUID()
      const userId2 = crypto.randomUUID()
      userRepository.contains.mockResolvedValue(true)
      chatRepository.create.mockResolvedValue(createMockChat({ type: CHAT_TYPES.PRIVATE }))

      await chatService.createChat({ participants: [userId2], type: CHAT_TYPES.PRIVATE }, userId1)

      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ admin: undefined })
      )
    })

    it('does not set groupName for private chats', async () => {
      const userId1 = crypto.randomUUID()
      const userId2 = crypto.randomUUID()
      userRepository.contains.mockResolvedValue(true)
      chatRepository.create.mockResolvedValue(createMockChat({ type: CHAT_TYPES.PRIVATE }))

      await chatService.createChat(
        { participants: [userId2], type: CHAT_TYPES.PRIVATE, groupName: 'Should be ignored' },
        userId1
      )

      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ groupName: undefined })
      )
    })

    it('automatically adds creator to participants', async () => {
      const creatorId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      userRepository.contains.mockResolvedValue(true)
      chatRepository.create.mockResolvedValue(createMockChat())

      await chatService.createChat({ participants: [userId], type: CHAT_TYPES.PRIVATE }, creatorId)

      expect(chatRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: expect.arrayContaining([creatorId, userId]),
        })
      )
    })

    it('throws ValidationError when one or more participants do not exist', async () => {
      userRepository.contains.mockResolvedValue(false)

      await expect(
        chatService.createChat(
          { participants: [crypto.randomUUID()], type: CHAT_TYPES.PRIVATE },
          crypto.randomUUID()
        )
      ).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError with USER_NOT_FOUND code when participants missing', async () => {
      userRepository.contains.mockResolvedValue(false)
      try {
        await chatService.createChat(
          { participants: [crypto.randomUUID()], type: CHAT_TYPES.PRIVATE },
          crypto.randomUUID()
        )
      } catch (err) {
        expect(err.code).toBe('USER_NOT_FOUND')
      }
    })
  })

  // ─── getUserChats ─────────────────────────────────────────────────────────

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

    it('uses defaults when options is empty', async () => {
      const userId = crypto.randomUUID()
      chatRepository.countDocuments.mockResolvedValue(0)
      chatRepository.findAllWithPopulate.mockResolvedValue([])

      const result = await chatService.getUserChats(userId)
      expect(result.chats).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('passes correct populate fields', async () => {
      const userId = crypto.randomUUID()
      chatRepository.countDocuments.mockResolvedValue(1)
      chatRepository.findAllWithPopulate.mockResolvedValue([createMockChat()])

      await chatService.getUserChats(userId)

      expect(chatRepository.findAllWithPopulate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({ path: 'participants' }),
          expect.objectContaining({ path: 'admin' }),
        ])
      )
    })

    it('merges userId into query alongside filter', async () => {
      const userId = crypto.randomUUID()
      chatRepository.countDocuments.mockResolvedValue(0)
      chatRepository.findAllWithPopulate.mockResolvedValue([])

      await chatService.getUserChats(userId, { filter: { type: CHAT_TYPES.PRIVATE } })

      expect(chatRepository.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ participants: userId })
      )
    })
  })

  // ─── getChatById ──────────────────────────────────────────────────────────

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

    it('throws AuthorizationError with NOT_A_MEMBER code', async () => {
      const mockChat = createMockChat({ participants: [crypto.randomUUID()] })
      chatRepository.findById.mockResolvedValue(mockChat)
      try {
        await chatService.getChatById('chatId', crypto.randomUUID())
      } catch (err) {
        expect(err.code).toBe('NOT_A_MEMBER')
      }
    })
  })

  // ─── updateChat ───────────────────────────────────────────────────────────

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

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)
      await expect(chatService.updateChat('noId', 'userId', {})).rejects.toThrow(NotFoundError)
    })

    it('throws ValidationError for private chats', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.updateChat(mockChat._id, 'userId', { groupName: 'X' })
      ).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError with INVALID_CHAT_TYPE code for private chat update', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)
      try {
        await chatService.updateChat(mockChat._id, 'userId', {})
      } catch (err) {
        expect(err.code).toBe('INVALID_CHAT_TYPE')
      }
    })

    it('throws AuthorizationError when a non-admin tries to update', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, admin: adminId })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.updateChat('chatId', crypto.randomUUID().toString(), { groupName: 'New' })
      ).rejects.toThrow(AuthorizationError)
    })

    it('throws ValidationError when new admin is not a participant', async () => {
      const adminId = crypto.randomUUID()
      const nonMemberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.updateChat(mockChat._id, adminId.toString(), { admin: nonMemberId })
      ).rejects.toThrow(ValidationError)
    })

    it('allows changing admin to an existing participant', async () => {
      const adminId = crypto.randomUUID()
      const newAdminId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, newAdminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue({ ...mockChat, admin: newAdminId })

      const result = await chatService.updateChat(mockChat._id, adminId.toString(), {
        admin: newAdminId,
      })
      expect(result.admin).toBe(newAdminId)
    })

    it('ignores disallowed update fields', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.updateChat(mockChat._id, adminId.toString(), {
        groupName: 'Valid',
        participants: ['inject'], // not in allowedUpdates
        type: 'private', // not in allowedUpdates
      })

      const updateArg = chatRepository.findByIdAndUpdate.mock.calls[0][1]
      expect(updateArg.$set).not.toHaveProperty('participants')
      expect(updateArg.$set).not.toHaveProperty('type')
      expect(updateArg.$set).toHaveProperty('groupName', 'Valid')
    })
  })

  // ─── deleteChat ───────────────────────────────────────────────────────────

  describe('deleteChat', () => {
    it('deletes a group chat as admin', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, admin: adminId })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndDelete.mockResolvedValue(mockChat)

      await chatService.deleteChat(mockChat._id, adminId.toString())

      expect(chatRepository.findByIdAndDelete).toHaveBeenCalledWith(mockChat._id)
    })

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)
      await expect(chatService.deleteChat('noId', 'userId')).rejects.toThrow(NotFoundError)
    })

    it('throws ValidationError for private chats', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(chatService.deleteChat(mockChat._id, 'userId')).rejects.toThrow(ValidationError)
    })

    it('throws AuthorizationError when non-admin tries to delete', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({ type: CHAT_TYPES.GROUP, admin: adminId })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.deleteChat(mockChat._id, crypto.randomUUID().toString())
      ).rejects.toThrow(AuthorizationError)
    })
  })

  // ─── addMember ────────────────────────────────────────────────────────────

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

    it('allows a user to add themselves (join)', async () => {
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

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)
      await expect(chatService.addMember('noId', 'userId', null)).rejects.toThrow(NotFoundError)
    })

    it('throws ValidationError for private chats', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(chatService.addMember('chatId', 'userId', null)).rejects.toThrow(ValidationError)
    })

    it('throws AuthorizationError when non-admin tries to add another user', async () => {
      const adminId = crypto.randomUUID()
      const nonAdminId = crypto.randomUUID()
      const newMemberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, nonAdminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.addMember('chatId', nonAdminId.toString(), newMemberId.toString())
      ).rejects.toThrow(AuthorizationError)
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

    it('throws ConflictError with ALREADY_MEMBER code', async () => {
      const adminId = crypto.randomUUID()
      const existingMemberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, existingMemberId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      try {
        await chatService.addMember('chatId', adminId.toString(), existingMemberId.toString())
      } catch (err) {
        expect(err.code).toBe('ALREADY_MEMBER')
      }
    })
  })

  // ─── removeMember ─────────────────────────────────────────────────────────

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

    it('allows admin to remove another member', async () => {
      const adminId = crypto.randomUUID()
      const memberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, memberId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', adminId.toString(), memberId.toString())

      expect(chatRepository.findByIdAndUpdate).toHaveBeenCalledWith(
        'chatId',
        expect.objectContaining({ $pull: { participants: memberId.toString() } })
      )
    })

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)
      await expect(chatService.removeMember('noId', 'u', 'u')).rejects.toThrow(NotFoundError)
    })

    it('throws ValidationError for private chats', async () => {
      const mockChat = createMockChat({ type: CHAT_TYPES.PRIVATE })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(chatService.removeMember('chatId', 'u', 'u')).rejects.toThrow(ValidationError)
    })

    it('throws AuthorizationError when non-admin tries to remove another member', async () => {
      const adminId = crypto.randomUUID()
      const nonAdminId = crypto.randomUUID()
      const targetId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, nonAdminId, targetId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.removeMember('chatId', nonAdminId.toString(), targetId.toString())
      ).rejects.toThrow(AuthorizationError)
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

    it('throws ConflictError with ADMIN_TRANSFER_REQUIRED code', async () => {
      const adminId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId, crypto.randomUUID()],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      try {
        await chatService.removeMember('chatId', adminId.toString(), adminId.toString())
      } catch (err) {
        expect(err.code).toBe('ADMIN_TRANSFER_REQUIRED')
      }
    })

    it('throws ValidationError when admin tries to remove a non-member', async () => {
      const adminId = crypto.randomUUID()
      const nonMemberId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        admin: adminId,
        participants: [adminId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(
        chatService.removeMember('chatId', adminId.toString(), nonMemberId.toString())
      ).rejects.toThrow(ValidationError)
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

    it('does not delete chat when members remain after removal', async () => {
      const userId = crypto.randomUUID()
      const otherId = crypto.randomUUID()
      const mockChat = createMockChat({
        type: CHAT_TYPES.GROUP,
        participants: [userId, otherId],
      })
      chatRepository.findById.mockResolvedValue(mockChat)
      chatRepository.findByIdAndUpdate.mockResolvedValue(mockChat)

      await chatService.removeMember('chatId', userId.toString(), userId.toString())

      expect(chatRepository.findByIdAndDelete).not.toHaveBeenCalled()
    })
  })

  // ─── getMembers ───────────────────────────────────────────────────────────

  describe('getMembers', () => {
    it('returns participants for a member of the chat', async () => {
      const userId = crypto.randomUUID()
      const mockUser = { id: userId, username: 'alice', avatar: null }
      const mockChat = { _id: crypto.randomUUID(), participants: [userId] }
      chatRepository.findById.mockResolvedValue(mockChat)
      userRepository.findById.mockResolvedValue(mockUser)

      const result = await chatService.getMembers('chatId', userId)
      expect(result).toEqual([mockUser])
    })

    it('throws NotFoundError when chat does not exist', async () => {
      chatRepository.findById.mockResolvedValue(null)
      await expect(chatService.getMembers('noId', 'userId')).rejects.toThrow(NotFoundError)
    })

    it('throws AuthorizationError when user is not a participant', async () => {
      const userId = crypto.randomUUID()
      const mockChat = { _id: crypto.randomUUID(), participants: [crypto.randomUUID()] }
      chatRepository.findById.mockResolvedValue(mockChat)
      await expect(chatService.getMembers('chatId', userId)).rejects.toThrow(AuthorizationError)
    })

    it('fetches user data for each participant', async () => {
      const userId = crypto.randomUUID()
      const otherId = crypto.randomUUID()
      const mockChat = { _id: crypto.randomUUID(), participants: [userId, otherId] }
      chatRepository.findById.mockResolvedValue(mockChat)
      userRepository.findById.mockResolvedValue({ id: userId, username: 'alice' })

      await chatService.getMembers('chatId', userId)

      expect(userRepository.findById).toHaveBeenCalledTimes(2)
    })
  })

  // ─── formatChat ───────────────────────────────────────────────────────────

  describe('formatChat', () => {
    it('returns null when chat is null', () => {
      expect(chatService.formatChat(null)).toBeNull()
    })

    it('returns null when chat is undefined', () => {
      expect(chatService.formatChat(undefined)).toBeNull()
    })

    it('maps chat fields to formatted output', () => {
      const adminId = crypto.randomUUID()
      const chatId = crypto.randomUUID()
      const now = new Date()
      const mockChat = {
        _id: chatId,
        type: CHAT_TYPES.GROUP,
        groupName: 'My Group',
        groupPicture: 'http://example.com/pic.jpg',
        admin: adminId,
        participants: [adminId],
        createdAt: now,
        updatedAt: now,
      }
      const result = chatService.formatChat(mockChat)
      expect(result).toEqual({
        id: chatId,
        type: CHAT_TYPES.GROUP,
        name: 'My Group',
        picture: 'http://example.com/pic.jpg',
        admin: adminId,
        participants: [adminId],
        createdAt: now,
        updatedAt: now,
      })
    })

    it('returns undefined for optional fields when absent', () => {
      const mockChat = {
        _id: crypto.randomUUID(),
        type: CHAT_TYPES.PRIVATE,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const result = chatService.formatChat(mockChat)
      expect(result.name).toBeUndefined()
      expect(result.picture).toBeUndefined()
      expect(result.admin).toBeUndefined()
    })
  })
})
