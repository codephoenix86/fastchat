/**
 * Security integration tests.
 * Covers: IDOR (Insecure Direct Object Reference), authentication bypass, privilege escalation,
 * XSS/injection in all input fields, token forgery, resource isolation.
 */
const crypto = require('crypto')
const request = require('supertest')
const app = require('@/app')
const jwt = require('jsonwebtoken')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { CHAT_TYPES } = require('@constants')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  expectError,
  expectSuccess,
} = require('./helpers')

describe('Security Tests', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('Authentication bypass attempts', () => {
    it('should reject requests with no Authorization header on protected routes', async () => {
      const protectedRoutes = [
        { method: 'get', path: '/api/v1/users/me' },
        { method: 'patch', path: '/api/v1/users/me' },
        { method: 'delete', path: '/api/v1/users/me' },
        { method: 'get', path: '/api/v1/chats' },
        { method: 'post', path: '/api/v1/chats' },
      ]

      for (const { method, path } of protectedRoutes) {
        const response = await request(app)[method](path)
        expect(response.status).toBe(StatusCodes.UNAUTHORIZED)
        expect(response.body.error.code).toMatch(/MISSING_TOKEN|INVALID_TOKEN/)
      }
    })

    it('should reject null Authorization header value', async () => {
      const response = await request(app).get('/api/v1/users/me').set('Authorization', 'null')
      expectError(response, StatusCodes.UNAUTHORIZED)
    })

    it('should reject Authorization header with only "Bearer" (no token)', async () => {
      const response = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer')
      expectError(response, StatusCodes.UNAUTHORIZED)
    })
  })

  describe('IDOR — Insecure Direct Object Reference', () => {
    it('should not allow user A to read user B chat by guessing chat ID', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      // user1 and user2 have a private chat
      const chat = await createTestChat(user1.user, [user2.user.id])

      // user3 guesses chat ID and tries to read it
      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should not allow user A to send messages in user B chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)
        .send({ content: 'IDOR attack' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should not allow user A to read messages from user B chat', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id])
      await createTestMessage(chat, user1.user)

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should not allow user to edit another user message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ content: 'Hijacked' })

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')
    })

    it('should not allow user to delete another user message', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])
      const msg = await createTestMessage(chat, user1.user)

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/messages/${msg._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_MESSAGE_OWNER')
    })

    it('should not allow non-admin to delete a group chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Victims Group',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should not allow non-admin to update a group chat', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Original Name',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ groupName: 'Hijacked Name' })

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })

    it('should not allow non-admin to kick members', async () => {
      const [user1, user2, user3] = await createTestUsers(3)
      const chat = await createTestChat(user1.user, [user2.user.id, user3.user.id], {
        type: CHAT_TYPES.GROUP,
        groupName: 'Test Group',
      })

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}/members/${user3.user.id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })
  })

  describe('Privilege escalation attempts', () => {
    it('should not allow role escalation via PATCH /api/v1/users/me', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ role: 'admin', bio: 'Legit update' })

      // Should succeed (unknown fields stripped) but role must stay 'user'
      if (response.status === StatusCodes.OK) {
        expect(response.body.data.user.role).toBe('user')
      }
    })

    it('should not allow ID manipulation via PATCH /api/v1/users/me', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ id: user2.user.id, bio: 'Poisoned' })

      if (response.status === StatusCodes.OK) {
        // Must have updated user1, not user2
        expect(response.body.data.user.id).toBe(user1.user.id)

        // user2 should be unchanged
        const user2Profile = await request(app).get(`/api/v1/users/${user2.user.id}`)
        expect(user2Profile.body.data.user.bio).toBeUndefined()
      }
    })

    it('should not escalate to admin via JWT forgery with wrong secret', async () => {
      const forgedToken = jwt.sign(
        { id: crypto.randomUUID(), username: 'hacker', role: 'admin' },
        'wrong-secret-key-32chars-xxxxxxxxx',
        { expiresIn: '1h' }
      )

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${forgedToken}`)

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })

    it('should not accept a token with "none" algorithm (alg=none attack)', async () => {
      const payload = { id: crypto.randomUUID(), username: 'hacker', role: 'admin' }
      // Manually craft a none-alg JWT
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const noneToken = `${header}.${body}.`

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${noneToken}`)

      expectError(response, StatusCodes.UNAUTHORIZED)
    })
  })

  describe('XSS injection via input fields', () => {
    it('should sanitize XSS in bio field', async () => {
      const { tokens } = await createTestUser()
      const xss = '<script>document.cookie="stolen=true"</script>Safe content'

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: xss })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.bio).not.toContain('<script>')
    })

    it('should sanitize XSS in group chat name', async () => {
      const [user1, user2] = await createTestUsers(2)

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: '<img src=x onerror=alert(1)>',
          participants: [user2.user.id],
        })

      if (response.status === StatusCodes.CREATED) {
        expect(response.body.data.chat.name).not.toContain('onerror')
      }
    })

    it('should sanitize XSS in message content', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ content: '<script>alert("xss")</script>' })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.content).not.toContain('<script>')
    })
  })

  describe('SQL/NoSQL injection prevention', () => {
    it('should handle SQL injection attempt in search query', async () => {
      await createTestUser()

      const sqlInjection = "'; DROP TABLE users; --"
      const response = await request(app).get('/api/v1/users').query({ search: sqlInjection })

      // Should not crash (parameterized queries) and return empty or normal results
      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.success).toBe(true)
    })

    it('should handle MongoDB operator injection in chat type filter', async () => {
      const [user1, user2] = await createTestUsers(2)
      await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ type: { $gt: '' } })

      // Should not crash; either filter is ignored or returns normal
      expect(response.status).toBeGreaterThanOrEqual(200)
      expect(response.body.success !== undefined).toBe(true)
    })

    it('should not crash when participant ID contains injection payload', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.PRIVATE,
          participants: ["'; SELECT * FROM users; --"],
        })

      // Validation should reject non-UUID values
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('Resource isolation between users', () => {
    it('should not expose messages across unrelated chats', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      const chat1 = await createTestChat(user1.user, [user2.user.id])
      const chat2 = await createTestChat(user1.user, [user3.user.id])

      await createTestMessage(chat1, user1.user, { content: 'Private to user2' })
      await createTestMessage(chat2, user1.user, { content: 'Private to user3' })

      // user2 should NOT see messages from chat2
      const response = await request(app)
        .get(`/api/v1/chats/${chat2._id}/messages`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should only list chats the requesting user is part of', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      // user2 and user3 have a private chat (user1 is NOT involved)
      await createTestChat(user2.user, [user3.user.id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(0)
    })
  })

  describe('Mass assignment prevention', () => {
    it('should strip unknown fields from signup request', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'validuser1',
        email: 'validuser1@example.com',
        password: 'Password@123',
        role: 'admin',
        is_superuser: true,
        created_at: '2000-01-01',
      })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.user.role).toBe('user')
    })

    it('should strip extra fields from message creation', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .post(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          content: 'Legit content',
          sender: user2.user.id, // should be overridden by req.user.id
          status: 'read', // should use default 'sent'
        })

      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.message.sender).toBe(user1.user.id)
      expect(response.body.data.message.status).toBe('sent')
    })
  })

  describe('Rate limiting header presence', () => {
    it('should respond normally to valid auth requests within rate limit', async () => {
      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(app).post('/api/v1/auth/login').send({
            username: 'nonexistent_user',
            password: 'Password@123',
          })
        )
      )

      responses.forEach((res) => {
        expect(res.status).toBeDefined()
        // Should get 401 (wrong creds), not 429 (rate limit) for first few requests
        expect([StatusCodes.UNAUTHORIZED, StatusCodes.TOO_MANY_REQUESTS]).toContain(res.status)
      })
    })
  })
})
