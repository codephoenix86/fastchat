const request = require('supertest')
const app = require('@/app')
const {
  db: { clearDatabase },
} = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  expectError,
  expectSuccess,
  expectPagination,
} = require('./helpers')
const { CHAT_TYPES } = require('@constants')

describe('Messages API', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  describe('POST /api/v1/chats/:chatId/messages', () => {
    it('should send message successfully', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Hello, world!' })

      expectSuccess(response, StatusCodes.CREATED, 'Message sent successfully')
      expect(response.body.data.message.content).toBe('Hello, world!')
      expect(response.body.data.message.sender).toBe(user1.user._id.toString())
      expect(response.body.data.message.chat).toBe(chat._id.toString())
      expect(response.body.data.message.status).toBe('sent')
    })

    it('should return 400 for empty content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for missing content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for content too long', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'a'.repeat(5001) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 404 for non-existent chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats/507f1f77bcf86cd799439011/messages')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ content: 'Hello' })

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 403 when user is not a participant', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({ content: 'Hello' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 400 for invalid chat id', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats/invalid-id/messages')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ content: 'Hello' })

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })
  })

  describe('GET /api/v1/chats/:chatId/messages', () => {
    it('should get messages with pagination', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      await createTestMessage(chat, user1.user, { content: 'Message 1' })
      await createTestMessage(chat, user2.user, { content: 'Message 2' })
      await createTestMessage(chat, user1.user, { content: 'Message 3' })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Messages fetched successfully')
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBe(3)
      expectPagination(response)
      expect(response.body.pagination.total).toBe(3)
    })

    it('should paginate messages correctly', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      for (let i = 0; i < 60; i++) {
        await createTestMessage(chat, user1.user, { content: `Message ${i + 1}` })
      }

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 1, limit: 50 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.length).toBe(50)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.total).toBe(60)
      expect(response.body.pagination.hasNextPage).toBe(true)
    })

    it('should sort messages by createdAt descending by default', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const msg1 = await createTestMessage(chat, user1.user, { content: 'First' })
      const msg2 = await createTestMessage(chat, user2.user, { content: 'Second' })
      const msg3 = await createTestMessage(chat, user3.user, { content: 'Third' })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data[0].id).toBe(msg3._id.toString())
      expect(response.body.data[1].id).toBe(msg2._id.toString())
      expect(response.body.data[2].id).toBe(msg1._id.toString())
    })

    it('should return 404 for non-existent chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats/507f1f77bcf86cd799439011/messages')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 403 when user is not a participant', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should populate sender information', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data[0].sender).toBeDefined()
      expect(response.body.data[0].sender.username).toBe(user1.user.username)
    })
  })

  describe('GET /api/v1/chats/:chatId/messages/:messageId', () => {
    it('should get message by id', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Message fetched successfully')
      expect(response.body.data.message.id).toBe(message._id.toString())
      expect(response.body.data.message.content).toBe(message.content)
    })

    it('should return 404 for non-existent message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/507f1f77bcf86cd799439011`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 403 when user is not in chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 400 for invalid message id', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/invalid-id`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })
  })

  describe('PATCH /api/v1/chats/:chatId/messages/:messageId', () => {
    it('should update message successfully', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user, { content: 'Original' })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Updated content' })

      expectSuccess(response, StatusCodes.OK, 'Message updated successfully')
      expect(response.body.data.message.content).toBe('Updated content')
    })

    it('should return 403 when trying to edit others message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ content: 'Hacked' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')
    })

    it('should return 400 for empty content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for content too long', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'a'.repeat(5001) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 404 for non-existent message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/507f1f77bcf86cd799439011`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Updated' })

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('DELETE /api/v1/chats/:chatId/messages/:messageId', () => {
    it('should delete message successfully', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Message deleted successfully')

      // Verify message is deleted
      const deletedMessage = await require('@models').Message.findById(message._id)
      expect(deletedMessage).toBeNull()
    })

    it('should return 403 when trying to delete others message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])
      const message = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${message._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')
    })

    it('should return 404 for non-existent message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/507f1f77bcf86cd799439011`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 400 for invalid message id', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/invalid-id`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })
  })

  describe('Message operations in group chats', () => {
    it('should send message in group chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id, user3.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Group message' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toBe('Group message')
    })

    it('should get messages from group chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id, user3.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      await createTestMessage(chat, user1.user, { content: 'Message from user1' })
      await createTestMessage(chat, user2.user, { content: 'Message from user2' })
      await createTestMessage(chat, user3.user, { content: 'Message from user3' })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(3)
    })

    it('should not allow non-members to send messages', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user._id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({ content: 'Unauthorized message' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })
  })

  describe('Message edge cases', () => {
    it('should handle special characters in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const specialContent = '<script>alert("xss")</script> & "quotes" \'apostrophes\''

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: specialContent })

      expectSuccess(response, StatusCodes.CREATED)
      // Content should be sanitized
      expect(response.body.data.message.content).toBeDefined()
    })

    it('should handle emojis in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const emojiContent = 'Hello 👋 World 🌍 😊'

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: emojiContent })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toContain('👋')
    })

    it('should handle newlines in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const multilineContent = 'Line 1\nLine 2\nLine 3'

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: multilineContent })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toBe(multilineContent)
    })

    it('should trim whitespace from message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user._id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '   trimmed   ' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toBe('trimmed')
    })
  })
})
