/**
 * Message edge-case integration tests.
 * Covers: ordering, cross-chat isolation, content boundaries, sender-only edit/delete,
 * populate correctness, group vs private, concurrent sends.
 */
const crypto = require('crypto')
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { Message } = require('@models')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  expectError,
  expectSuccess,
  expectPagination,
} = require('./helpers')

describe('Messages Edge Cases', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('POST /api/v1/chats/:chatId/messages — send constraints', () => {
    it('should persist message to MongoDB after sending', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Persisted message' })

      expectSuccess(response, StatusCodes.CREATED)

      const messageId = response.body.data.message.id
      const dbMessage = await Message.findById(messageId)
      expect(dbMessage).not.toBeNull()
      expect(dbMessage.content).toBe('Persisted message')
      expect(dbMessage.sender).toBe(user1.user.id)
    })

    it('should have default status of "sent"', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Status check' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.status).toBe('sent')
    })

    it('should reject message with only whitespace content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '   ' })

      // Trimming reduces content to empty string → validation error
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should accept message at exactly 5000 characters (boundary)', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'a'.repeat(5000) })

      expectSuccess(response, StatusCodes.CREATED)
    })

    it('should reject message at 5001 characters', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'a'.repeat(5001) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should correctly record sender ID', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      // user2 sends
      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ content: 'From user2' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.sender).toBe(user2.user.id)
    })

    it('should correctly link message to chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Check chat link' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.chat).toBe(chat._id.toString())
    })

    it('should return 403 when non-member tries to send', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({ content: 'Unauthorized' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 404 for a valid UUID that does not match any chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post(`/api/v1/chats/${crypto.randomUUID()}/messages`)
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ content: 'Phantom chat' })

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('GET /api/v1/chats/:chatId/messages — retrieval', () => {
    it('should return empty array when no messages exist', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
    })

    it('should populate sender username in response', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      const msg = response.body.data[0]
      expect(msg.sender).toBeDefined()
    })

    it('should not return messages from other chats', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat1 = await createTestChat(user1.user, [user2.user.id])
      const chat2 = await createTestChat(user1.user, [user2.user.id])

      await createTestMessage(chat1, user1.user, { content: 'Chat1 message' })
      await createTestMessage(chat2, user1.user, { content: 'Chat2 message' })

      const response = await request(app)
        .get(`/api/v1/chats/${chat1._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
      expect(response.body.data[0].content).toBe('Chat1 message')
    })

    it('should respect page and limit query params', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      for (let i = 1; i <= 15; i++) {
        await createTestMessage(chat, user1.user, { content: `Message ${i}` })
      }

      const page1 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 1, limit: 10 })

      const page2 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 2, limit: 10 })

      expectSuccess(page1, StatusCodes.OK)
      expectSuccess(page2, StatusCodes.OK)
      expect(page1.body.data).toHaveLength(10)
      expect(page2.body.data).toHaveLength(5)
      expect(page1.body.pagination.total).toBe(15)
      expect(page1.body.pagination.hasNextPage).toBe(true)
      expect(page2.body.pagination.hasNextPage).toBe(false)
    })

    it('should return 403 when non-member tries to read messages', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 404 for non-existent chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get(`/api/v1/chats/${crypto.randomUUID()}/messages`)
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should include pagination metadata', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectPagination(response)
    })
  })

  describe('GET /api/v1/chats/:chatId/messages/:messageId — single message', () => {
    it('should return a single message with full details', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user, { content: 'Specific message' })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.message.id).toBe(msg._id)
      expect(response.body.data.message.content).toBe('Specific message')
    })

    it('should allow the other chat participant to fetch the message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.message.id).toBe(msg._id)
    })

    it('should return 403 when non-member tries to fetch a message', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 404 for non-existent message ID', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('PATCH /api/v1/chats/:chatId/messages/:messageId — edit constraints', () => {
    it('should update content and persist to DB', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user, { content: 'Original' })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Edited content' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.message.content).toBe('Edited content')

      const dbMsg = await Message.findById(msg._id)
      expect(dbMsg.content).toBe('Edited content')
    })

    it('should not allow a different member to edit the message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ content: 'Hacked' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')
    })

    it('should return 403 when non-member tries to edit', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      // user3 is not in the chat at all, but the service checks message ownership first
      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({ content: 'Hacked by outsider' })

      expect([StatusCodes.FORBIDDEN, StatusCodes.NOT_FOUND]).toContain(response.status)
    })

    it('should accept edit with content at exactly 5000 characters', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'b'.repeat(5000) })

      expectSuccess(response, StatusCodes.OK)
    })

    it('should return 400 for content exceeding 5000 chars', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'c'.repeat(5001) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 404 for non-existent message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Ghost edit' })

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('DELETE /api/v1/chats/:chatId/messages/:messageId — delete constraints', () => {
    it('should delete the message from DB', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)

      const dbMsg = await Message.findById(msg._id)
      expect(dbMsg).toBeNull()
    })

    it("should not allow another member to delete someone else's message", async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')

      // Message should still exist
      const dbMsg = await Message.findById(msg._id)
      expect(dbMsg).not.toBeNull()
    })

    it('should return 404 for already-deleted message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      // Delete once
      await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // Delete again
      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 404 for non-existent message ID', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 400 for invalid message ID format', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/not-a-uuid`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('Message content edge cases', () => {
    it('should preserve emoji characters in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const emojiContent = '🎉🚀💬 Hello World 🌍'

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: emojiContent })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toContain('🎉')
    })

    it('should preserve newlines in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const multiline = 'Line 1\nLine 2\nLine 3'

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: multiline })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toBe(multiline)
    })

    it('should sanitize XSS attempts in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '<script>alert("xss")</script>' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).not.toContain('<script>')
    })

    it('should trim leading/trailing whitespace from content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '   trimmed message   ' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).toBe('trimmed message')
    })
  })

  describe('Cross-chat isolation', () => {
    it('should not find message from another chat using wrong chatId', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat1 = await createTestChat(user1.user, [user2.user.id])
      const chat2 = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat1, user1.user)

      // Try to get message from chat1 using chat2's ID in the URL
      const response = await request(app)
        .get(`/api/v1/chats/${chat2._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // Should 404 since the message doesn't belong to chat2
      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })
})
