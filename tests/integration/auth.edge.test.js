/**
 * Auth edge-case integration tests.
 * Covers: token reuse attacks, concurrent sessions, expiry, boundary validation.
 */
const request = require('supertest')
const app = require('@/app')
const jwt = require('jsonwebtoken')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { redis, env } = require('@config')
const client = redis.getClient()
const {
  createTestUser,
  expectError,
  expectSuccess,
  generateUsername,
  generateEmail,
} = require('./helpers')

describe('Auth Edge Cases', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('Signup edge cases', () => {
    it('should trim whitespace from email but reject invalid format', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: '  notanemail  ',
        password: 'Password@123',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject username starting with a number', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: '1startnum',
        email: generateEmail(),
        password: 'Password@123',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject username with double underscores', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'user__name',
        email: generateEmail(),
        password: 'Password@123',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject password without lowercase letter', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'PASSWORD@123',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject password without digit', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password@abc',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject password under 8 characters', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'P@ss1',
      })
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should not return password_hash in signup response', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password@123',
      })
      expectSuccess(response, StatusCodes.CREATED)
      expect(response.body.data.user.password).toBeUndefined()
      expect(response.body.data.user.password_hash).toBeUndefined()
    })

    it('should allow identical passwords for different users', async () => {
      const password = 'Password@123'
      const res1 = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password,
      })
      const res2 = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password,
      })
      expectSuccess(res1, StatusCodes.CREATED)
      expectSuccess(res2, StatusCodes.CREATED)
    })

    it('should return 409 on duplicate email regardless of username case variation', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: user.email,
        password: 'Password@123',
      })
      expectError(response, StatusCodes.CONFLICT, 'EMAIL_ALREADY_EXISTS')
    })
  })

  describe('Login edge cases', () => {
    it('should return same error for wrong username and wrong password (no enumeration)', async () => {
      const wrongUsernameRes = await request(app).post('/api/v1/auth/login').send({
        username: 'definitelynotauser',
        password: 'Password@123',
      })
      const { user } = await createTestUser()
      const wrongPasswordRes = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'WrongPassword@999',
      })

      expect(wrongUsernameRes.status).toBe(StatusCodes.UNAUTHORIZED)
      expect(wrongPasswordRes.status).toBe(StatusCodes.UNAUTHORIZED)
      expect(wrongUsernameRes.body.error.code).toBe(wrongPasswordRes.body.error.code)
      expect(wrongUsernameRes.body.error.message).toBe(wrongPasswordRes.body.error.message)
    })

    it('should issue a new token pair on each login', async () => {
      const { user } = await createTestUser()

      const login1 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })
      const login2 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })

      expectSuccess(login1, StatusCodes.OK)
      expectSuccess(login2, StatusCodes.OK)
      expect(login1.body.data.accessToken).not.toBe(login2.body.data.accessToken)
      expect(login1.body.data.refreshToken).not.toBe(login2.body.data.refreshToken)
    })

    it('should support concurrent active sessions from multiple logins', async () => {
      const { user } = await createTestUser()

      const login1 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })
      const login2 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })

      const token1 = login1.body.data.accessToken
      const token2 = login2.body.data.accessToken

      // Both access tokens should independently work
      const me1 = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token1}`)
      const me2 = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token2}`)

      expectSuccess(me1, StatusCodes.OK)
      expectSuccess(me2, StatusCodes.OK)
    })

    it('should login successfully with email (case-insensitive identifier lookup)', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: 'Password@123',
      })
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.id).toBe(user.id)
    })
  })

  describe('Logout edge cases', () => {
    it('should revoke only the submitted refresh token, not all sessions', async () => {
      const { user } = await createTestUser()

      const login1 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })
      const login2 = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })

      const rt1 = login1.body.data.refreshToken
      const rt2 = login2.body.data.refreshToken
      const at2 = login2.body.data.accessToken

      // Logout session 1
      await request(app).post('/api/v1/auth/logout').type('form').send({ refresh_token: rt1 })
      expectSuccess(login1, StatusCodes.OK)

      // Session 2 refresh token should still be valid
      const refresh2 = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: rt2 })
      expectSuccess(refresh2, StatusCodes.OK)

      // Session 2 access token should still work
      const me2 = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${at2}`)
      expectSuccess(me2, StatusCodes.OK)
    })

    it('should return 401 when trying to logout with already-used refresh token', async () => {
      const { tokens } = await createTestUser()

      // Logout once
      await request(app)
        .post('/api/v1/auth/logout')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })

      // Try to logout again with same token
      const secondLogout = await request(app)
        .post('/api/v1/auth/logout')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })
      expectError(secondLogout, StatusCodes.UNAUTHORIZED, 'SESSION_NOT_FOUND')
    })
  })

  describe('Token refresh edge cases', () => {
    it('should not reuse the old refresh token after rotation', async () => {
      const { tokens } = await createTestUser()
      const oldRefresh = tokens.refreshToken

      // Rotate
      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: oldRefresh })
      expectSuccess(refresh, StatusCodes.OK)

      // Old token must be dead
      const reuse = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: oldRefresh })
      expectError(reuse, StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED')
    })

    it('should return new access token different from old one', async () => {
      const { tokens } = await createTestUser()

      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })
      expectSuccess(refresh, StatusCodes.OK)

      expect(refresh.body.data.accessToken).not.toBe(tokens.accessToken)
      expect(refresh.body.data.refreshToken).not.toBe(tokens.refreshToken)
    })

    it('should return 400 when refresh_token field is missing', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({})
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 for a fabricated refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: 'aaaaaabbbbbbcccccc' })
      expectError(response, StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED')
    })
  })

  describe('Access token edge cases', () => {
    it('should reject an expired JWT', async () => {
      const expiredToken = jwt.sign(
        { id: 'some-id', username: 'u', role: 'user' },
        env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: '-1s',
        }
      )

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
      expectError(response, StatusCodes.UNAUTHORIZED, 'TOKEN_EXPIRED')
    })

    it('should reject a JWT signed with wrong secret', async () => {
      const fakeToken = jwt.sign(
        { id: 'fake-id', username: 'u', role: 'user' },
        'wrong-secret-key-32chars-xxxxxxxx',
        {
          expiresIn: '1h',
        }
      )

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${fakeToken}`)
      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })

    it('should reject token without Bearer prefix', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', tokens.accessToken)
      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })

    it('should reject empty Bearer string', async () => {
      const response = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer ')
      expectError(response, StatusCodes.UNAUTHORIZED)
    })

    it('should reject token with tampered payload', async () => {
      const { tokens } = await createTestUser()
      const parts = tokens.accessToken.split('.')
      // Tamper the payload
      const fakePayload = Buffer.from(JSON.stringify({ id: 'hacked', role: 'admin' })).toString(
        'base64url'
      )
      const tamperedToken = `${parts[0]}.${fakePayload}.${parts[2]}`

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })
  })

  describe('Refresh token stored correctly in Redis', () => {
    it('should store refresh token in Redis on login', async () => {
      const { user } = await createTestUser()

      await client.flushall()

      const login = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })
      expectSuccess(login, StatusCodes.OK)

      const stored = await client.get(`rt:${login.body.data.refreshToken}`)
      expect(stored).toBe(user.id)
    })

    it('should remove refresh token from Redis on logout', async () => {
      const { tokens } = await createTestUser()

      await request(app)
        .post('/api/v1/auth/logout')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })

      const stored = await client.get(`rt:${tokens.refreshToken}`)
      expect(stored).toBeNull()
    })
  })
})
