const request = require('supertest')
const path = require('path')
const fs = require('fs').promises
const app = require('@/app')
const {
  db: { clearDatabase },
} = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const {
  createTestUser,
  createTestUsers,
  expectError,
  expectSuccess,
  expectPagination,
  generateUsername,
  generateEmail,
} = require('./helpers')

describe('Users API', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  describe('GET /api/v1/users', () => {
    it('should get all users with default pagination', async () => {
      await createTestUsers(3)

      const response = await request(app).get('/api/v1/users')

      expectSuccess(response, StatusCodes.OK, 'Users fetched successfully')
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBe(3)
      expectPagination(response)
      expect(response.body.pagination.total).toBe(3)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(20)
    })

    it('should paginate users correctly', async () => {
      await createTestUsers(25)

      const response = await request(app).get('/api/v1/users').query({ page: 2, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.length).toBe(10)
      expect(response.body.pagination.page).toBe(2)
      expect(response.body.pagination.total).toBe(25)
      expect(response.body.pagination.hasNextPage).toBe(true)
      expect(response.body.pagination.hasPrevPage).toBe(true)
    })

    it('should search users by username', async () => {
      await createTestUser({ username: 'alice123' })
      await createTestUser({ username: 'bob456' })
      await createTestUser({ username: 'alice789' })

      const response = await request(app).get('/api/v1/users').query({ search: 'alice' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(2)
    })

    it('should search users by email', async () => {
      await createTestUser({ email: 'alice@example.com' })
      await createTestUser({ email: 'bob@example.com' })

      const response = await request(app).get('/api/v1/users').query({ search: 'alice' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
    })

    it('should filter users by role', async () => {
      await createTestUser({ role: 'admin' })
      await createTestUser({ role: 'user' })
      await createTestUser({ role: 'user' })

      const response = await request(app).get('/api/v1/users').query({ role: 'admin' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
    })

    it('should sort users by username ascending', async () => {
      await createTestUser({ username: 'charlie' })
      await createTestUser({ username: 'alice' })
      await createTestUser({ username: 'bob' })

      const response = await request(app).get('/api/v1/users').query({ sort: 'username' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data[0].username).toBe('alice')
      expect(response.body.data[2].username).toBe('charlie')
    })

    it('should sort users by createdAt descending', async () => {
      const user3 = await createTestUser()

      const response = await request(app).get('/api/v1/users').query({ sort: '-createdAt' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data[0].id).toBe(user3.user._id.toString())
    })

    it('should return empty array when no users match search', async () => {
      await createTestUser()

      const response = await request(app).get('/api/v1/users').query({ search: 'nonexistent' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
    })

    it('should not include password field in response', async () => {
      await createTestUser()

      const response = await request(app).get('/api/v1/users')

      expectSuccess(response, StatusCodes.OK)
      response.body.data.forEach((user) => {
        expect(user.password).toBeUndefined()
      })
    })
  })

  describe('GET /api/v1/users/:id', () => {
    it('should get user by id', async () => {
      const { user } = await createTestUser()

      const response = await request(app).get(`/api/v1/users/${user._id}`)

      expectSuccess(response, StatusCodes.OK, 'User fetched successfully')
      expect(response.body.data.user.id).toBe(user._id.toString())
      expect(response.body.data.user.username).toBe(user.username)
      expect(response.body.data.user.email).toBe(user.email)
      expect(response.body.data.user.password).toBeUndefined()
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/v1/users/507f1f77bcf86cd799439011')

      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 400 for invalid user id', async () => {
      const response = await request(app).get('/api/v1/users/invalid-id')

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })
  })

  describe('GET /api/v1/users/me', () => {
    it('should get current user profile', async () => {
      const { user, tokens } = await createTestUser()

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Current user details')
      expect(response.body.data.user.id).toBe(user._id.toString())
      expect(response.body.data.user.username).toBe(user.username)
    })

    it('should return 401 when authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/users/me')

      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid_token')

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
    })
  })

  describe('PATCH /api/v1/users/me', () => {
    it('should update username', async () => {
      const { tokens } = await createTestUser()
      const newUsername = generateUsername()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newUsername })

      expectSuccess(response, StatusCodes.OK, 'User updated successfully')
      expect(response.body.data.user.username).toBe(newUsername)
    })

    it('should update bio', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newBio: 'Updated bio' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.bio).toBe('Updated bio')
    })

    it('should update email with old password', async () => {
      const { tokens } = await createTestUser()
      const newEmail = generateEmail()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newEmail,
          oldPassword: 'Password@123',
        })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.email).toBe(newEmail)
    })

    it('should update password with old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newPassword: 'NewPassword@456',
          oldPassword: 'Password@123',
        })

      expectSuccess(response, StatusCodes.OK)
    })

    it('should return 400 when updating email without old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newEmail: generateEmail() })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when updating password without old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newPassword: 'NewPassword@456' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 for incorrect old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newEmail: generateEmail(),
          oldPassword: 'WrongPassword@123',
        })

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_PASSWORD')
    })

    it('should return 409 for duplicate email', async () => {
      const existingEmail = generateEmail()
      await createTestUser({ email: existingEmail })
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newEmail: existingEmail,
          oldPassword: 'Password@123',
        })

      expectError(response, StatusCodes.CONFLICT, 'EMAIL_ALREADY_EXISTS')
    })

    it('should return 409 for duplicate username', async () => {
      const existingUsername = generateUsername()
      await createTestUser({ username: existingUsername })
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newUsername: existingUsername })

      expectError(response, StatusCodes.CONFLICT, 'USERNAME_ALREADY_TAKEN')
    })

    it('should return 400 for invalid username format', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newUsername: '123invalid' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for bio too long', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newBio: 'a'.repeat(201) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 when no fields are provided', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })

  describe('DELETE /api/v1/users/me', () => {
    it('should delete user account', async () => {
      const { user, tokens } = await createTestUser()

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Account deleted successfully')

      // Verify user is deleted
      const deletedUser = await require('@models').User.findById(user._id)
      expect(deletedUser).toBeNull()
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app).delete('/api/v1/users/me')

      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })
  })

  describe('POST /api/v1/users/me/avatar', () => {
    const testImagePath = path.join(__dirname, '..', 'fixtures', 'test-avatar.jpg')

    beforeAll(async () => {
      // Create test fixtures directory if it doesn't exist
      const fixturesDir = path.join(__dirname, '..', 'fixtures')

      await fs.mkdir(fixturesDir, { recursive: true })

      // Create a minimal test image if it doesn't exist
      try {
        await fs.access(testImagePath)
      } catch {
        // Create a minimal valid JPEG file (1x1 pixel)
        const minimalJpeg = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
          0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
          0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
          0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
        ])
        await fs.writeFile(testImagePath, minimalJpeg)
      }
    })

    it('should upload avatar successfully', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .attach('avatar', testImagePath)

      expectSuccess(response, StatusCodes.OK, 'Avatar uploaded successfully')
      expect(response.body.data.user.avatar).toBeDefined()
      expect(response.body.data.user.avatar).not.toBeNull()
    })

    it('should return 400 when no file is uploaded', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectError(response, StatusCodes.BAD_REQUEST, 'BAD_REQUEST')
    })

    it('should return 415 for invalid file type', async () => {
      const { tokens } = await createTestUser()
      const txtFilePath = path.join(__dirname, '..', 'fixtures', 'test.txt')

      // Create a text file
      await fs.writeFile(txtFilePath, 'test content')

      const response = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .attach('avatar', txtFilePath)

      // Clean up
      await fs.unlink(txtFilePath)

      expectError(response, StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_FILE_TYPE')
    })
  })

  describe('DELETE /api/v1/users/me/avatar', () => {
    it('should delete avatar', async () => {
      const { tokens } = await createTestUser({ avatar: 'test-avatar.jpg' })

      const response = await request(app)
        .delete('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK, 'Avatar removed successfully')
      expect(response.body.data.user.avatar).toBeUndefined()
    })

    it('should succeed even when user has no avatar', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .delete('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
    })
  })

  describe('PATCH /api/v1/users/me/password', () => {
    it('should change password successfully', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          oldPassword: 'Password@123',
          newPassword: 'NewPassword@456',
        })

      expectSuccess(response, StatusCodes.OK, 'Password changed successfully')
    })

    it('should return 400 for missing old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ newPassword: 'NewPassword@456' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 400 for missing new password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ oldPassword: 'Password@123' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 for incorrect old password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          oldPassword: 'WrongPassword@123',
          newPassword: 'NewPassword@456',
        })

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_PASSWORD')
    })

    it('should return 400 for weak new password', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          oldPassword: 'Password@123',
          newPassword: 'weak',
        })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })
  })
})
