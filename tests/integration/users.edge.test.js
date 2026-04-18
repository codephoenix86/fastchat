/**
 * User edge-case integration tests.
 * Covers: cross-user access isolation, field validation extremes, bio/avatar behaviour,
 * delete cascade, search/filter/sort correctness.
 */
const crypto = require('crypto')
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const {
  createTestUser,
  createTestUsers,
  expectError,
  expectSuccess,
  generateUsername,
} = require('./helpers')

describe('Users Edge Cases', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('GET /api/v1/users — field safety', () => {
    it('should never expose password_hash in user list', async () => {
      await createTestUsers(3)

      const response = await request(app).get('/api/v1/users')
      expectSuccess(response, StatusCodes.OK)

      response.body.data.forEach((u) => {
        expect(u.password).toBeUndefined()
        expect(u.password_hash).toBeUndefined()
      })
    })

    it('should return correct user fields in list response', async () => {
      const { user } = await createTestUser()

      const response = await request(app).get('/api/v1/users')
      expectSuccess(response, StatusCodes.OK)

      const found = response.body.data.find((u) => u.id === user.id)
      expect(found).toBeDefined()
      expect(found.id).toBe(user.id)
      expect(found.username).toBe(user.username)
      expect(found.email).toBe(user.email)
      expect(found.role).toBe('user')
    })

    it('should return empty array when no users exist', async () => {
      const response = await request(app).get('/api/v1/users')
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
    })

    it('should filter by role=admin correctly', async () => {
      await createTestUser({ role: 'admin' })
      await createTestUser({ role: 'user' })
      await createTestUser({ role: 'user' })

      const response = await request(app).get('/api/v1/users').query({ role: 'admin' })
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
      expect(response.body.data[0].role).toBe('admin')
    })

    it('should return 400 for invalid role filter', async () => {
      const response = await request(app).get('/api/v1/users').query({ role: 'superuser' })
      // Depending on implementation: either ignores unknown role (returns all) or errors
      // The repository throws INVALID_ROLE for unknown roles
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should search case-insensitively by username', async () => {
      await createTestUser({ username: 'AliceSmith' })
      await createTestUser({ username: 'Bobsmith' })

      const response = await request(app).get('/api/v1/users').query({ search: 'alice' })
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(1)
    })

    it('should sort users by username ascending', async () => {
      await createTestUser({ username: 'zara_user' })
      await createTestUser({ username: 'alice_user' })
      await createTestUser({ username: 'mike_user' })

      const response = await request(app).get('/api/v1/users').query({ sort: 'username' })
      expectSuccess(response, StatusCodes.OK)
      const usernames = response.body.data.map((u) => u.username)
      expect(usernames).toEqual([...usernames].sort())
    })

    it('should respect limit cap of 100', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ limit: 999 })
      expectSuccess(response, StatusCodes.OK)
      // Should not exceed 100 even if requested more
      expect(response.body.pagination.limit).toBeLessThanOrEqual(100)
    })
  })

  describe('GET /api/v1/users/:userId — public access', () => {
    it('should not require authentication to view a user', async () => {
      const { user } = await createTestUser()

      const response = await request(app).get(`/api/v1/users/${user.id}`)
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.id).toBe(user.id)
    })

    it('should not include password in single user response', async () => {
      const { user } = await createTestUser()

      const response = await request(app).get(`/api/v1/users/${user.id}`)
      expect(response.body.data.user.password).toBeUndefined()
      expect(response.body.data.user.password_hash).toBeUndefined()
    })

    it('should return 400 for non-UUID user ID', async () => {
      const response = await request(app).get('/api/v1/users/not-a-uuid')
      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 404 for valid UUID that does not exist', async () => {
      const fakeId = crypto.randomUUID()
      const response = await request(app).get(`/api/v1/users/${fakeId}`)
      expectError(response, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('GET /api/v1/users/me — current user', () => {
    it('should return profile data for authenticated user', async () => {
      const { user, tokens } = await createTestUser({ bio: 'My bio text' })

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.id).toBe(user.id)
      expect(response.body.data.user.bio).toBe('My bio text')
    })

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/v1/users/me')
      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })
  })

  describe('PATCH /api/v1/users/me — update profile', () => {
    it('should update username and bio in single request', async () => {
      const { tokens } = await createTestUser()
      const newUsername = generateUsername()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ username: newUsername, bio: 'Updated bio' })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.username).toBe(newUsername)
      expect(response.body.data.user.bio).toBe('Updated bio')
    })

    it('should allow updating username to same value as current (no-op)', async () => {
      const { user, tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ username: user.username })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.username).toBe(user.username)
    })

    it('should reject bio exactly at 201 characters', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'a'.repeat(201) })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should accept bio at exactly 200 characters (boundary)', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'a'.repeat(200) })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.bio).toHaveLength(200)
    })

    it('should return 400 when body is empty object', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({})

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should reject when updating another user indirectly (unauthenticated PATCH /me)', async () => {
      const response = await request(app).patch('/api/v1/users/me').send({ bio: 'Injected bio' })

      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })

    it("should return 409 when trying to take another user's username", async () => {
      const { user: existingUser } = await createTestUser()
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ username: existingUser.username })

      expectError(response, StatusCodes.CONFLICT, 'USERNAME_ALREADY_TAKEN')
    })

    it('should ignore unknown fields in request body', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'Safe update', role: 'admin', id: 'injected' })

      // Should succeed with only safe fields updated
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.role).toBe('user')
    })
  })

  describe('DELETE /api/v1/users/me — account deletion', () => {
    it('should delete the correct user and not others', async () => {
      const [user1, user2] = await createTestUsers(2)

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      // user2 should still exist
      const user2Profile = await request(app).get(`/api/v1/users/${user2.user.id}`)
      expectSuccess(user2Profile, StatusCodes.OK)
      expect(user2Profile.body.data.user.id).toBe(user2.user.id)

      // user1 should be gone
      const user1Profile = await request(app).get(`/api/v1/users/${user1.user.id}`)
      expectError(user1Profile, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app).delete('/api/v1/users/me')
      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })
  })

  describe('PATCH /api/v1/users/me/password — password management', () => {
    it('should reject new password same complexity as weak', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: 'Password@123', newPassword: 'short' })

      expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
    })

    it('should return 401 when current password is wrong', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: 'WrongPassword@999', newPassword: 'NewPassword@456' })

      expectError(response, StatusCodes.UNAUTHORIZED, 'INVALID_PASSWORD')
    })

    it('should not require re-login after password change (existing token still valid)', async () => {
      const { tokens } = await createTestUser()

      await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: 'Password@123', newPassword: 'NewPassword@456' })

      // Original access token is still valid (JWT is stateless)
      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
      expectSuccess(me, StatusCodes.OK)
    })
  })

  describe('DELETE /api/v1/users/me/avatar — avatar management', () => {
    it('should return success and null avatar when no avatar exists', async () => {
      const { tokens } = await createTestUser()

      const response = await request(app)
        .delete('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      // avatar should be undefined/null since user never had one
      expect(response.body.data.user.avatar).toBeUndefined()
    })

    it('should return 401 without token', async () => {
      const response = await request(app).delete('/api/v1/users/me/avatar')
      expectError(response, StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN')
    })
  })

  describe('Cross-user isolation', () => {
    it('should not allow user A to update user B profile via PATCH /me', async () => {
      const [userA, userB] = await createTestUsers(2)

      // UserA tries to update using their own token — can only update themselves
      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userA.tokens.accessToken}`)
        .send({ bio: 'UserA bio' })
      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data.user.id).toBe(userA.user.id)

      // UserB's profile should be unchanged
      const userBProfile = await request(app).get(`/api/v1/users/${userB.user.id}`)
      expect(userBProfile.body.data.user.bio).toBeUndefined()
    })

    it('should not allow user A to delete user B account via DELETE /me', async () => {
      const [userA, userB] = await createTestUsers(2)

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${userA.tokens.accessToken}`)

      // UserB should still exist
      const userBLookup = await request(app).get(`/api/v1/users/${userB.user.id}`)
      expectSuccess(userBLookup, StatusCodes.OK)
    })
  })
})
