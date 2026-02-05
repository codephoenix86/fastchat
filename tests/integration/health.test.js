const request = require('supertest')
const app = require('@/app')
const {
  db: { connectTestDB, disconnectTestDB },
} = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')

describe('Health API', () => {
  describe('GET /health', () => {
    it('should return health status with database connected', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.status).toBe('OK')
      expect(response.body.uptime).toBeDefined()
      expect(typeof response.body.uptime).toBe('number')
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.environment).toBeDefined()
      expect(response.body.version).toBe('1.0.0')
      expect(response.body.checks).toBeDefined()
      expect(response.body.checks.database).toBe('connected')
    })

    it('should include correct environment', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.environment).toBe('test')
    })

    it('should return degraded status when database is disconnected', async () => {
      // Temporarily close database connection
      await disconnectTestDB()

      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.SERVICE_UNAVAILABLE)
      expect(response.body.status).toBe('DEGRADED')
      expect(response.body.checks.database).toBe('disconnected')

      // Reconnect for other tests
      await connectTestDB()
    })

    it('should return uptime as positive number', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.uptime).toBeGreaterThan(0)
    })

    it('should return timestamp as number', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.OK)
      expect(typeof response.body.timestamp).toBe('number')
      expect(response.body.timestamp).toBeGreaterThan(0)
    })

    it('should be accessible without authentication', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCodes.OK)
      expect(response.body.status).toBeDefined()
    })

    it('should return consistent structure', async () => {
      const response = await request(app).get('/health')

      expect(response.body).toMatchObject({
        uptime: expect.any(Number),
        timestamp: expect.any(Number),
        status: expect.any(String),
        environment: expect.any(String),
        version: expect.any(String),
        checks: expect.objectContaining({
          database: expect.any(String),
        }),
      })
    })
  })
})
