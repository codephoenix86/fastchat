const request = require('supertest')
const app = require('@/app')
const { redis } = require('@config')
const client = redis.getClient()
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const {
  createTestUser,
  expectError,
  expectSuccess,
  generateUsername,
  generateEmail,
} = require('./helpers')
const { postgres } = require('@config')
const pool = postgres.getPool()

describe('Auth API', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password@123',
      }

      const response = await request(app).post('/api/v1/auth/signup').send(userData)
      expectSuccess(response, StatusCodes.CREATED, 'User created successfully')
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.user.username).toBe(userData.username)
      expect(response.body.data.user.email).toBe(userData.email)
      expect(response.body.data.user.role).toBe('user')
      expect(response.body.data.user.password).toBeUndefined()

      const result = await pool.query(
        'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND email = $2)',
        [userData.username, userData.email]
      )
      expect(result.rows[0].exists).toBe(true)
    })

    it('should return 409 for duplicate email', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: user.email,
        password: 'Password@123',
      })

      expectError(response, StatusCodes.CONFLICT, 'EMAIL_ALREADY_EXISTS')
      expect(response.body.error.message).toBe('Email already exists')
    })

    it('should return 409 for duplicate username', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/signup').send({
        username: user.username,
        email: generateEmail(),
        password: 'Password@123',
      })

      expectError(response, StatusCodes.CONFLICT, 'USERNAME_ALREADY_TAKEN')
      expect(response.body.error.message).toBe('Username already taken')
    })

    it('should return 400 for missing email', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for invalid email format', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: 'invalid-email',
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for missing username', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        email: generateEmail(),
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for username too short', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: 'ab',
        email: generateEmail(),
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for username too long', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          username: 'a'.repeat(25),
          email: generateEmail(),
          password: 'Password@123',
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for invalid username format', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: '123invalid',
        email: generateEmail(),
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for missing password', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for weak password', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'weakpass',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for password without uppercase', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for password without special character', async () => {
      const response = await request(app).post('/api/v1/auth/signup').send({
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login with username successfully', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })

      expectSuccess(response, StatusCodes.OK, 'User logged in successfully')
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.user.id).toBe(user.id)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
    })

    it('should login with email successfully', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: 'Password@123',
      })

      expectSuccess(response, StatusCodes.OK, 'User logged in successfully')
      expect(response.body.data.user.id).toBe(user.id)
    })

    it('should return 401 for invalid username', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        username: 'nonexistent',
        password: 'Password@123',
      })

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS')
      expect(response.body.error.message).toBe('Invalid email/username or password')
    })

    it('should return 401 for invalid password', async () => {
      const { user } = await createTestUser()

      const response = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'WrongPassword@123',
      })

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS')
    })

    it('should return 400 when both username and email are missing', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        password: 'Password@123',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for missing password', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        username: 'testuser',
      })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should store refresh token in database', async () => {
      const { user } = await createTestUser()

      await client.flushall()

      const response = await request(app).post('/api/v1/auth/login').send({
        username: user.username,
        password: 'Password@123',
      })

      expectSuccess(response, StatusCodes.OK)

      const result = await client.get(`rt:${response.body.data.refreshToken}`)
      expect(result).not.toBe(null)
      expect(result).toBe(user.id)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const { user, tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .type('form')
        .send({ refresh_token: tokens.refreshToken })

      expectSuccess(response, StatusCodes.OK, 'User logged out successfully')

      const [key] = await client.keys(`rt:${user.id}:*`)
      const result = await client.get(key)

      expect(result).toBeNull()
    })

    it('should return 400 for missing refresh token', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 for invalid refresh token', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .type('form')
        .send({ refresh_token: 'invalid_refresh_token' })

      expectError(response, StatusCodes.UNAUTHORIZED, 'SESSION_NOT_FOUND')
    })

    it('should pass without access token', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })

      expectSuccess(response, StatusCodes.OK)
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const { user, tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })
      expectSuccess(response, StatusCodes.OK, 'Tokens refreshed successfully')
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.accessToken).not.toBe(tokens.accessToken)
      expect(response.body.data.refreshToken).not.toBe(tokens.refreshToken)

      const [key] = await client.keys(`rt:${user.id}:*`)
      const newToken = await client.get(key)

      expect(newToken).not.toBe(tokens.refreshToken)
    })

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh')

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 for non-existent refresh token', async () => {
      const { tokens } = await createTestUser()

      await client.flushall()

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })

      expectError(response, StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED')
    })
  })
})
