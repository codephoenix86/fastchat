const request = require('supertest')
const app = require('@/app')
const {
  db: { clearDatabase },
} = require('@tests/helpers')
const { createTestUser, expectError } = require('./helpers')
const { StatusCodes } = require('http-status-codes')

describe('Error Handling', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  describe('404 Not Found', () => {
    it('should return 404 for non-existent route', async () => {
      const response = await request(app).get('/api/v1/nonexistent')

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Route not found')
      expect(response.body.timestamp).toBeDefined()
    })

    it('should return 404 for invalid API version', async () => {
      const response = await request(app).get('/api/v2/users')

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body.success).toBe(false)
    })

    it('should return 404 for non-existent nested route', async () => {
      const response = await request(app).get('/api/v1/users/me/invalid')

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body.success).toBe(false)
    })

    it('should return 404 with proper error structure', async () => {
      const response = await request(app).get('/invalid/path')

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
        status: 404,
        timestamp: expect.any(String),
      })
    })
  })

  describe('Authentication Errors', () => {
    it('should return 401 for missing authorization header', async () => {
      const response = await request(app).get('/api/v1/users/me')

      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
      expect(response.body.error.message).toBe('Authorization token missing')
    })

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid_token')

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })

    it('should return 401 for expired token', async () => {
      const jwt = require('jsonwebtoken')
      const { env } = require('@config')

      const expiredToken = jwt.sign({ id: 'test' }, env.JWT_SECRET, { expiresIn: '-1h' })

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)

      expectError(response, StatusCodes.UNAUTHORIZED, 'TOKEN_EXPIRED')
    })

    it('should return 401 for malformed token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not.a.valid.token')

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })

    it('should return 401 for missing Bearer prefix', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', tokens.accessToken)

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })
  })

  describe('Validation Errors', () => {
    it('should return validation errors with details', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'ab', // Too short
        email: 'invalid-email', // Invalid format
        password: 'weak', // Too weak
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
      expect(response.body.error.details).toBeDefined()
      expect(Array.isArray(response.body.error.details)).toBe(true)
      expect(response.body.error.details.length).toBeGreaterThan(0)
    })

    it('should include field information in validation errors', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'validuser',
        email: 'invalid',
        password: 'ValidPass@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
      expect(response.body.error.details).toBeDefined()
      const emailError = response.body.error.details.find((e) => e.field === 'email')
      expect(emailError).toBeDefined()
    })

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/v1/auth/login')

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
      expect(response.body.error.message).toBe('Invalid request data')
    })

    it('should validate data types', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newUsername: 12345 }) // Should be string

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('Malformed Request Body', () => {
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.body.success).toBe(false)
    })

    it('should handle empty request body when data is required', async () => {
      const response = await request(app).post('/api/v1/auth/signup')

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should handle null values appropriately', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: null,
        email: null,
        password: null,
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('Authorization Errors', () => {
    it('should return 403 when accessing resource without permission', async () => {
      const [user1, user2, user3] = await require('./helpers').createTestUsers(3)
      const chat = await require('./helpers').createTestChat(user1.user, [user2.user])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user3.tokens.accessToken}`)

      expectError(response, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })

    it('should return 403 when non-admin tries admin action', async () => {
      const [user1, user2] = await require('./helpers').createTestUsers(2)
      const chat = await require('./helpers').createTestChat(user1.user, [user2.user._id], {
        type: 'group',
        groupName: 'Test',
      })

      const response = await request(app)
        .patch(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .send({ groupName: 'Hacked' })

      expectError(response, StatusCodes.FORBIDDEN, 'ADMIN_REQUIRED')
    })
  })

  describe('Conflict Errors', () => {
    it('should return 409 for duplicate email', async () => {
      const existingUser = await createTestUser()

      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'newuser',
        email: existingUser.user.email,
        password: 'Password@123',
      })

      expectError(response, StatusCodes.CONFLICT, 'EMAIL_ALREADY_EXISTS')
      expect(response.body.error.message).toContain(
        'This email address is already registered. Please log in instead.'
      )
    })

    it('should return 409 for duplicate username', async () => {
      const existingUser = await createTestUser()

      const response = await request(app).post('/api/v1/auth/signup').send({
        username: existingUser.user.username,
        email: 'new@example.com',
        password: 'Password@123',
      })

      expectError(response, StatusCodes.CONFLICT, 'USERNAME_ALREADY_TAKEN')
      expect(response.body.error.message).toContain(
        'That username is already taken. Please try another one.'
      )
    })
  })

  describe('Error Response Structure', () => {
    it('should include request ID in error responses', async () => {
      const response = await request(app).get('/api/v1/nonexistent')
      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body.requestId).toBeDefined()
      expect(typeof response.body.requestId).toBe('string')
    })

    it('should include timestamp in error responses', async () => {
      const response = await request(app).get('/api/v1/nonexistent')

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
      expect(response.body.timestamp).toBeDefined()
      expect(typeof response.body.timestamp).toBe('string')
    })

    it('should have consistent error structure', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'wrong' })

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
        }),
        timestamp: expect.any(String),
        requestId: expect.any(String),
      })
    })

    it('should not expose stack traces in production mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'test', password: 'wrong' })

      expect(response.body.stack).toBeUndefined()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Rate Limiting Scenarios', () => {
    it('should handle concurrent requests gracefully', async () => {
      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(request(app).get('/health'))
      }

      const responses = await Promise.all(requests)

      responses.forEach((response) => {
        expect(response.status).toBe(StatusCodes.OK)
      })
    })
  })

  describe('XSS Protection', () => {
    it('should sanitize XSS attempts in request body', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newBio: '<script>alert("xss")</script>Safe content',
        })

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.data.user.bio).not.toContain('<script>')
    })

    it('should handle HTML entities in input', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newBio: '&lt;b&gt;Bold&lt;/b&gt;',
        })

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.data.user.bio).toBeDefined()
    })
  })

  describe('Content-Type Validation', () => {
    it('should require JSON content-type for POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .set('Content-Type', 'text/plain')
        .send('username=test&password=pass')

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should accept application/json content-type', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .set('Content-Type', 'application/json')
        .send({
          username: 'testuser123',
          email: 'test@example.com',
          password: 'Password@123',
        })

      // Should not fail due to content-type
      expect(response.status).not.toBe(415)
    })
  })

  describe('HTTP Method Validation', () => {
    it('should return 404 for unsupported HTTP methods', async () => {
      const response = await request(app).put('/api/v1/auth/signup').send({})

      expect(response.status).toBe(StatusCodes.NOT_FOUND)
    })

    it('should support correct HTTP methods for each endpoint', async () => {
      const { tokens } = await createTestUser()

      // PATCH should work
      const patchResponse = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newBio: 'Test' })

      expect(patchResponse.status).not.toBe(404)
      expect(patchResponse.status).not.toBe(405)
    })
  })
})
