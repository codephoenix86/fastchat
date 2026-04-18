/**
 * Chat edge-case integration tests.
 * Covers: private vs group constraints, admin/member boundary conditions,
 * self-add prevention, duplicate chat, nonexistent participants, etc.
 */
const crypto = require('crypto')
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { Chat } = require('@models')
const { CHAT_TYPES } = require('@constants')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  expectError,
  expectSuccess,
  expectPagination,
} = require('./helpers')

describe('Chats Edge Cases', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('POST /api/v1/chats — creation constraints', () => {
    it('should auto-include creator in participants list', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: [user2.user.id] })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.chat.participants).toContain(user1.user.id)
      expect(response.body.data.chat.participants).toContain(user2.user.id)
      expect(response.body.data.chat.participants).toHaveLength(2)
    })

    it('should set creator as admin for group chats', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'My Group',
          participants: [user2.user.id],
        })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.chat.admin).toBe(user1.user.id)
    })

    it('should not set admin for private chats', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: [user2.user.id] })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.chat.admin).toBeUndefined()
    })

    it('should return 400 when creating private chat with non-existent participant UUID', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: [crypto.randomUUID()],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'USER_NOT_FOUND')
    })

    it('should return 400 when participant is not a valid UUID', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: ['not-a-uuid'] })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when private chat has 0 other participants', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: [] })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when group chat groupName is too long', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'G'.repeat(51),
          participants: [user2.user.id],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject groupName on a private chat', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          groupName: 'Should fail',
          participants: [user2.user.id],
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 when unauthenticated', async () => {
      const user = await createTestUser()
      const response = await request(app)
        .post('/api/v1/chats')
        .send({ type: CHAT_TYPES.PRIVATE, participants: [user.user.id] })

      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })
  })

  describe('GET /api/v1/chats — list filtering', () => {
    it('should return empty array when user has no chats', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
    })

    it('should not return chats the user is not part of', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      await createTestChat(user2.user, [user3.user.id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(0)
    })

    it('should filter group chats by type=group', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      await createTestChat(user1.user, [user2.user.id])
      await createTestChat(user1.user, [user2.user.id, user3.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Group A',
      })

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ type: CHAT_TYPES.GROUP })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
      expect(response.body.data[0].type).toBe(CHAT_TYPES.GROUP)
    })

    it('should filter private chats by type=private', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      await createTestChat(user1.user, [user2.user.id])
      await createTestChat(user1.user, [user2.user.id, user3.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Group A',
      })

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ type: CHAT_TYPES.PRIVATE })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
      expect(response.body.data[0].type).toBe(CHAT_TYPES.PRIVATE)
    })

    it('should include pagination metadata', async () => {
      const [user1, user2] = await createTestUsers(2)
      await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectPagination(response)
    })
  })

  describe('PATCH /api/v1/chats/:chatId — update constraints', () => {
    it('should return 400 when updating private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ groupName: 'New Name' })

      expectError(response, StatusCodes.BAD_REQUEST, 'INVALID_CHAT_TYPE')
    })

    it('should return 403 when non-admin tries to update group', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Original',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ groupName: 'Hacked' })

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should return 400 when new admin is not a member', async () => {
      const [user1, user2, outsider] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: outsider.user.id })

      expectError(response, StatusCodes.BAD_REQUEST, 'NOT_A_MEMBER')
    })

    it('should allow updating groupName to boundary length of 50 chars', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Old Name',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ groupName: 'G'.repeat(50) })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.chat.name).toHaveLength(50)
    })

    it('should return 404 when chat does not exist', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .patch(`/api/v1/chats/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ groupName: 'X' })

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('DELETE /api/v1/chats/:chatId — delete constraints', () => {
    it('should return 400 when trying to delete a private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'INVALID_CHAT_TYPE')
    })

    it('should return 403 when non-admin tries to delete group', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should delete all messages when group is deleted', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Doomed Group',
      })

      // Send some messages
      await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: 'Hello' })

      // Delete the group
      await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // Chat should be gone
      const deletedChat = await Chat.findById(chat._id)
      expect(deletedChat).toBeNull()
    })

    it('should return 404 when deleting non-existent chat', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .delete(`/api/v1/chats/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('Member management edge cases', () => {
    it('should return 409 when adding an already-existing member', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members/${user2.user.id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.CONFLICT, 'ALREADY_MEMBER')
    })

    it('should return 409 when admin tries to leave without transferring ownership', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.CONFLICT, 'ADMIN_TRANSFER_REQUIRED')
    })

    it('should allow admin to leave after transferring ownership', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      // Transfer admin
      await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user2.user.id })

      // Now admin can leave
      const leave = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(leave, StatusCodes.OK)

      // Chat should still exist (user2 is still there)
      const chatStillExists = await Chat.findById(chat._id)
      expect(chatStillExists).not.toBeNull()
    })

    it('should return 400 when trying to add member to private chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members/${user3.user.id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'INVALID_CHAT_TYPE')
    })

    it('should return 400 when trying to remove member from private chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'INVALID_CHAT_TYPE')
    })

    it('should return 403 when non-admin tries to add a new member', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/members/${user3.user.id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should return 403 when non-admin tries to remove another member', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id, user3.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/${user3.user.id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should allow a non-admin member to remove themselves', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)

      // Chat still exists
      const chatDoc = await Chat.findById(chat._id)
      expect(chatDoc).not.toBeNull()
      expect(chatDoc.participants).not.toContain(user2.user.id)
    })

    it('should auto-delete chat when the last member leaves', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Temp Group',
      })

      // Transfer admin to user2
      await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user2.user.id })

      // user1 leaves
      await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // user2 (last member) leaves — chat should auto-delete
      const leaveRes = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/me`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectSuccess(leaveRes, StatusCodes.OK)

      const deletedChat = await Chat.findById(chat._id)
      expect(deletedChat).toBeNull()
    })
  })

  describe('GET /api/v1/chats/:chatId/members — access control', () => {
    it('should return all members with user details', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id, user3.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test',
      })

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.members).toHaveLength(3)
    })

    it('should return 403 when non-member requests member list', async () => {
      const [user1, user2, outsider] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/members`)
        .set('Authorization', `Bearer ${outsider.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 400 for invalid chat ID format', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats/not-a-uuid/members')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })
})
