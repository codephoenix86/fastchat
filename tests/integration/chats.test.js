const request = require('supertest')
const {
  db: { clearDatabase },
} = require('@tests/helpers')
const app = require('@/app')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  expectError,
  expectSuccess,
  expectPagination,
} = require('./helpers')
const { CHAT_TYPES } = require('@constants')
const { StatusCodes } = require('http-status-codes')

describe('Chats API', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  describe('POST /api/v1/chats', () => {
    it('should create private chat successfully', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: [user2.user._id.toString()],
        })

      expectSuccess(response, StatusCodes.CREATED, 'Chat created successfully')
      expect(response.body.data.chat.type).toBe(CHAT_TYPES.PRIVATE)
      expect(response.body.data.chat.participants).toHaveLength(2)
    })

    it('should create group chat successfully', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'Test Group',
          participants: [user2.user._id.toString(), user3.user._id.toString()],
        })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.chat.type).toBe(CHAT_TYPES.GROUP)
      expect(response.body.data.chat.name).toBe('Test Group')
      expect(response.body.data.chat.admin).toBe(user1.user._id.toString())
      expect(response.body.data.chat.participants).toHaveLength(3)
    })

    it('should return 400 when group chat missing group name', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          participants: [user2.user._id.toString()],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for invalid chat type', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: 'invalid',
          participants: [user2.user._id.toString()],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when private chat has more than 2 participants', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: [user2.user._id.toString(), user3.user._id.toString()],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when group chat has less than 2 participants', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'Test',
          participants: [],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for duplicate participants', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'Test',
          participants: [user2.user._id.toString(), user2.user._id.toString()],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for invalid participant ID', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: ['invalid-id'],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when participants do not exist', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: ['507f1f77bcf86cd799439011'],
        })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('GET /api/v1/chats', () => {
    it('should get user chats with pagination', async () => {
      const [user1, user2] = await createTestUsers(2)

      await createTestChat(user1.user, [user2.user._id])
      await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Chats fetched successfully')
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBe(2)
      expectPagination(response)
    })

    it('should filter chats by type', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      await createTestChat(user1.user, [user2.user._id])
      await createTestChat(user1.user, [user2.user._id, user3.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ type: CHAT_TYPES.GROUP })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
      expect(response.body.data[0].type).toBe(CHAT_TYPES.GROUP)
    })

    it('should paginate chats correctly', async () => {
      const [user1, user2] = await createTestUsers(2)

      for (let i = 0; i < 25; i++) {
        await createTestChat(user1.user, [user2.user._id])
      }

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 2, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.length).toBe(10)
      expect(response.body.pagination.page).toBe(2)
      expect(response.body.pagination.total).toBe(25)
    })

    it('should return only chats user is part of', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      await createTestChat(user1.user, [user2.user._id])
      await createTestChat(user2.user, [user3.user._id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
    })
  })

  describe('GET /api/v1/chats/:chatId', () => {
    it('should get chat by id', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Chat fetched successfully')
      expect(response.body.data.chat.id).toBe(chat._id.toString())
    })

    it('should return 404 for non-existent chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 403 when user is not a participant', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 400 for invalid chat id', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats/invalid-id')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })
  })

  describe('PATCH /api/v1/chats/:chatId', () => {
    it('should update group chat name as admin', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Old Name',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ groupName: 'New Name' })

      expectSuccess(response, StatusCodes.OK, 'Chat updated successfully')
      expect(response.body.data.chat.name).toBe('New Name')
    })

    it('should transfer admin rights', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user2.user._id.toString() })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.chat.admin).toBe(user2.user._id.toString())
    })

    it('should return 400 for private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ groupName: 'New Name' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 403 when non-admin tries to update', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ groupName: 'New Name' })

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should return 400 when admin is not a participant', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user3.user._id.toString() })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when no fields are provided', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('DELETE /api/v1/chats/:chatId', () => {
    it('should delete group chat as admin', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Chat deleted successfully')

      // Verify chat is deleted
      const deletedChat = await require('@models').Chat.findById(chat._id)
      expect(deletedChat).toBeNull()
    })

    it('should return 400 for private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 403 when non-admin tries to delete', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })
  })

  describe('GET /api/v1/chats/:chatId/members', () => {
    it('should get chat members', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id, user3.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Members fetched successfully')
      expect(response.body.data.members).toBeInstanceOf(Array)
      expect(response.body.data.members.length).toBe(3)
    })

    it('should return 403 when user is not a participant', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })
  })

  describe('POST /api/v1/chats/:chatId/members', () => {
    it('should add member to group as admin', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ userId: user3.user._id.toString() })

      expectSuccess(response, StatusCodes.OK, 'Member added successfully')
    })

    it('should allow user to add themselves', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({})

      expectSuccess(response, StatusCodes.OK)
    })

    it('should return 400 for private chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ userId: user3.user._id.toString() })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 403 when non-admin tries to add others', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ userId: user3.user._id.toString() })

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should return 409 when member already exists', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ userId: user2.user._id.toString() })

      expectError(response, StatusCodes.CONFLICT, 'ALREADY_MEMBER')
    })
  })

  describe('DELETE /api/v1/chats/:chatId/members/:userId', () => {
    it('should allow user to remove themselves', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Member removed successfully')
    })

    it('should allow admin to remove others', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/${user2.user._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
    })

    it('should return 403 when non-admin tries to remove others', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id, user3.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/${user3.user._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should return 409 when admin tries to leave without transfer', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.CONFLICT, 'ADMIN_TRANSFER_REQUIRED')
    })

    it('should delete chat when last member leaves', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      // Transfer admin to user2 first
      await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user2.user._id.toString() })

      // User1 leaves
      await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // User2 (last member and admin) leaves
      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Member removed successfully')

      // Verify chat is deleted
      const deletedChat = await require('@models').Chat.findById(chat._id)
      expect(deletedChat).toBeNull()
    })

    it('should return 400 for private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })
})
