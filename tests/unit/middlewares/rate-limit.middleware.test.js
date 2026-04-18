const mockRateLimit = jest.fn().mockReturnValue(jest.fn())
const MockRedisStore = jest.fn()

jest.mock('express-rate-limit', () => ({ rateLimit: mockRateLimit }))
jest.mock('rate-limit-redis', () => ({ RedisStore: MockRedisStore }))

const mockCall = jest.fn()
const mockClient = { call: mockCall }
jest.mock('@config', () => ({
  redis: { getClient: () => mockClient },
}))

const limitRate = require('@middlewares/rate-limit.middleware')

describe('rate-limit.middleware', () => {
  beforeEach(() => {
    mockRateLimit.mockClear()
    MockRedisStore.mockClear()
  })

  it('returns an Express middleware function', () => {
    const middleware = limitRate(60000, 10, 'auth')
    expect(typeof middleware).toBe('function')
  })

  it('calls rateLimit with the correct windowMs', () => {
    limitRate(900000, 5, 'auth')
    expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({ windowMs: 900000 }))
  })

  it('calls rateLimit with the correct max', () => {
    limitRate(60000, 100, 'msg')
    expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({ max: 100 }))
  })

  it('passes a RedisStore instance to rateLimit', () => {
    limitRate(60000, 10, 'auth')
    const storeArg = mockRateLimit.mock.calls[0][0].store
    expect(storeArg).toBeInstanceOf(MockRedisStore)
  })

  it('configures RedisStore with rl:{prefix}: key prefix', () => {
    limitRate(60000, 10, 'myprefix')
    const storeConfig = MockRedisStore.mock.calls[0][0]
    expect(storeConfig.prefix).toBe('rl:myprefix:')
  })

  it('wires sendCommand to client.call', () => {
    limitRate(60000, 10, 'auth')
    const { sendCommand } = MockRedisStore.mock.calls[0][0]
    sendCommand('INCR', 'key')
    expect(mockCall).toHaveBeenCalledWith('INCR', 'key')
  })

  it('creates independent limiters with different configs', () => {
    limitRate(60000, 5, 'auth')
    limitRate(900000, 100, 'msg')

    expect(mockRateLimit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ windowMs: 60000, max: 5 })
    )
    expect(mockRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ windowMs: 900000, max: 100 })
    )
    expect(MockRedisStore.mock.calls[0][0].prefix).toBe('rl:auth:')
    expect(MockRedisStore.mock.calls[1][0].prefix).toBe('rl:msg:')
  })
})
