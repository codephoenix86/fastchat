/**
 * Pagination integration tests.
 * Covers: all paginated endpoints with boundary conditions, invalid params, hasNextPage/hasPrevPage correctness.
 */
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  expectSuccess,
  expectPagination,
} = require('./helpers')

describe('Pagination', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('GET /api/v1/users — user list pagination', () => {
    it('should return correct pagination metadata for first page', async () => {
      await createTestUsers(25)

      const response = await request(app).get('/api/v1/users').query({ page: 1, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expectPagination(response)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(10)
      expect(response.body.pagination.total).toBe(25)
      expect(response.body.pagination.totalPages).toBe(3)
      expect(response.body.pagination.hasNextPage).toBe(true)
      expect(response.body.pagination.hasPrevPage).toBe(false)
      expect(response.body.data).toHaveLength(10)
    })

    it('should return correct pagination metadata for middle page', async () => {
      await createTestUsers(25)

      const response = await request(app).get('/api/v1/users').query({ page: 2, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.page).toBe(2)
      expect(response.body.pagination.hasNextPage).toBe(true)
      expect(response.body.pagination.hasPrevPage).toBe(true)
      expect(response.body.data).toHaveLength(10)
    })

    it('should return correct pagination metadata for last page', async () => {
      await createTestUsers(25)

      const response = await request(app).get('/api/v1/users').query({ page: 3, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.page).toBe(3)
      expect(response.body.pagination.hasNextPage).toBe(false)
      expect(response.body.pagination.hasPrevPage).toBe(true)
      expect(response.body.data).toHaveLength(5)
    })

    it('should return empty data and correct metadata for page beyond total', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ page: 99, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toHaveLength(0)
      expect(response.body.pagination.hasNextPage).toBe(false)
      expect(response.body.pagination.total).toBe(5)
    })

    it('should use default page=1 and limit=20 when not specified', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users')

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(20)
    })

    it('should cap limit at 100', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ limit: 500 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.limit).toBeLessThanOrEqual(100)
    })

    it('should return total=0 and empty data when no users exist', async () => {
      const response = await request(app).get('/api/v1/users')

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(0)
      expect(response.body.data).toHaveLength(0)
      expect(response.body.pagination.hasNextPage).toBe(false)
      expect(response.body.pagination.hasPrevPage).toBe(false)
    })

    it('should return exactly 1 item on last page of 1', async () => {
      await createTestUsers(11)

      const response = await request(app).get('/api/v1/users').query({ page: 2, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.pagination.hasNextPage).toBe(false)
    })

    it('should have consistent total across pages', async () => {
      await createTestUsers(15)

      const page1 = await request(app).get('/api/v1/users').query({ page: 1, limit: 10 })
      const page2 = await request(app).get('/api/v1/users').query({ page: 2, limit: 10 })

      expect(page1.body.pagination.total).toBe(page2.body.pagination.total)
      expect(page1.body.pagination.total).toBe(15)
    })
  })

  describe('GET /api/v1/chats — chat list pagination', () => {
    it('should paginate chats correctly', async () => {
      const [user1, user2] = await createTestUsers(2)

      for (let i = 0; i < 15; i++) {
        await createTestChat(user1.user, [user2.user.id])
      }

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 1, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expectPagination(response)
      expect(response.body.data).toHaveLength(10)
      expect(response.body.pagination.total).toBe(15)
      expect(response.body.pagination.hasNextPage).toBe(true)
    })

    it('should return second page of chats correctly', async () => {
      const [user1, user2] = await createTestUsers(2)

      for (let i = 0; i < 15; i++) {
        await createTestChat(user1.user, [user2.user.id])
      }

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 2, limit: 10 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toHaveLength(5)
      expect(response.body.pagination.hasPrevPage).toBe(true)
      expect(response.body.pagination.hasNextPage).toBe(false)
    })

    it('should return total=0 when user has no chats', async () => {
      const user = await createTestUser()

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(0)
      expect(response.body.data).toHaveLength(0)
    })

    it('should correctly count only chats the user participates in', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      // user1 is in 3 chats, user3 is in 2 chats, user1 is NOT in user3's chats
      await createTestChat(user1.user, [user2.user.id])
      await createTestChat(user1.user, [user2.user.id])
      await createTestChat(user1.user, [user2.user.id])
      await createTestChat(user2.user, [user3.user.id])
      await createTestChat(user2.user, [user3.user.id])

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.pagination.total).toBe(3)
    })
  })

  describe('GET /api/v1/chats/:chatId/messages — message pagination', () => {
    it('should paginate messages correctly across pages', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      for (let i = 0; i < 30; i++) {
        await createTestMessage(chat, user1.user, { content: `Message ${i + 1}` })
      }

      const page1 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 1, limit: 20 })

      const page2 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 2, limit: 20 })

      expectSuccess(page1, StatusCodes.OK)
      expectSuccess(page2, StatusCodes.OK)

      expect(page1.body.data).toHaveLength(20)
      expect(page2.body.data).toHaveLength(10)
      expect(page1.body.pagination.total).toBe(30)
      expect(page1.body.pagination.hasNextPage).toBe(true)
      expect(page2.body.pagination.hasPrevPage).toBe(true)
      expect(page2.body.pagination.hasNextPage).toBe(false)
    })

    it('should not duplicate messages across pages', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      for (let i = 0; i < 15; i++) {
        await createTestMessage(chat, user1.user, { content: `Message ${i + 1}` })
      }

      const page1 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 1, limit: 10 })

      const page2 = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .query({ page: 2, limit: 10 })

      const page1Ids = page1.body.data.map((m) => m.id)
      const page2Ids = page2.body.data.map((m) => m.id)

      const overlap = page1Ids.filter((id) => page2Ids.includes(id))
      expect(overlap).toHaveLength(0)
    })

    it('should use default limit of 50 for messages', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      for (let i = 0; i < 60; i++) {
        await createTestMessage(chat, user1.user, { content: `Message ${i + 1}` })
      }

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      // Default limit for messages is 50
      expect(response.body.data.length).toBeLessThanOrEqual(50)
      expect(response.body.pagination.total).toBe(60)
    })

    it('should return empty data and total=0 for chat with no messages', async () => {
      const [user1, user2] = await createTestUsers(2)
      const chat = await createTestChat(user1.user, [user2.user.id])

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toHaveLength(0)
      expect(response.body.pagination.total).toBe(0)
      expect(response.body.pagination.hasNextPage).toBe(false)
      expect(response.body.pagination.hasPrevPage).toBe(false)
    })
  })

  describe('Pagination edge values', () => {
    it('should treat page=0 as page=1 or return sensible result', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ page: 0, limit: 10 })

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.pagination.total).toBe(5)
    })

    it('should treat negative page as page=1 or return sensible result', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ page: -5, limit: 10 })

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.pagination.total).toBe(5)
    })

    it('should handle limit=1 correctly (one item per page)', async () => {
      await createTestUsers(3)

      const page1 = await request(app).get('/api/v1/users').query({ page: 1, limit: 1 })
      const page2 = await request(app).get('/api/v1/users').query({ page: 2, limit: 1 })
      const page3 = await request(app).get('/api/v1/users').query({ page: 3, limit: 1 })

      expect(page1.body.data).toHaveLength(1)
      expect(page2.body.data).toHaveLength(1)
      expect(page3.body.data).toHaveLength(1)
      expect(page1.body.pagination.totalPages).toBe(3)

      const ids = [page1.body.data[0].id, page2.body.data[0].id, page3.body.data[0].id]
      expect(new Set(ids).size).toBe(3) // All different
    })

    it('should handle limit larger than total items (single page)', async () => {
      await createTestUsers(5)

      const response = await request(app).get('/api/v1/users').query({ page: 1, limit: 100 })

      expectSuccess(response, StatusCodes.OK)
      expect(response.body.data).toHaveLength(5)
      expect(response.body.pagination.hasNextPage).toBe(false)
      expect(response.body.pagination.hasPrevPage).toBe(false)
      expect(response.body.pagination.totalPages).toBe(1)
    })
  })
})
