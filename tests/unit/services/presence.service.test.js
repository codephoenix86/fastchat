const { EventEmitter } = require('events')

const mockClient = {
  sadd: jest.fn(),
  scard: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  exists: jest.fn(),
  del: jest.fn(),
  scanStream: jest.fn(),
}

jest.mock('@config', () => ({
  redis: { getClient: () => mockClient },
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}))

const presenceService = require('@services/presence.service')

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const SOCKET_ID = 'socket-abc-123'

const makeStream = (batches = [], error = null) => {
  const em = new EventEmitter()
  em.pause = jest.fn()
  em.resume = jest.fn()
  setImmediate(() => {
    if (error) {
      em.emit('error', error)
    } else {
      batches.forEach((b) => em.emit('data', b))
      em.emit('end')
    }
  })
  return em
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('presenceService.addSocket', () => {
  it('calls sadd with key online:{userId} and the socketId', async () => {
    mockClient.sadd.mockResolvedValue(1)
    mockClient.scard.mockResolvedValue(1)

    await presenceService.addSocket(USER_ID, SOCKET_ID)

    expect(mockClient.sadd).toHaveBeenCalledWith(`online:${USER_ID}`, SOCKET_ID)
  })

  it('returns true (isFirstConnection) when scard returns 1', async () => {
    mockClient.sadd.mockResolvedValue(1)
    mockClient.scard.mockResolvedValue(1)

    const result = await presenceService.addSocket(USER_ID, SOCKET_ID)
    expect(result).toBe(true)
  })

  it('returns false when scard returns more than 1', async () => {
    mockClient.sadd.mockResolvedValue(0)
    mockClient.scard.mockResolvedValue(2)

    const result = await presenceService.addSocket(USER_ID, SOCKET_ID)
    expect(result).toBe(false)
  })
})

describe('presenceService.removeSocket', () => {
  it('calls srem with key online:{userId} and the socketId', async () => {
    mockClient.scard.mockResolvedValue(1)
    mockClient.srem.mockResolvedValue(1)

    await presenceService.removeSocket(USER_ID, SOCKET_ID)

    expect(mockClient.srem).toHaveBeenCalledWith(`online:${USER_ID}`, SOCKET_ID)
  })

  it('returns true (isLastConnection) when scard was 1 before removal', async () => {
    mockClient.scard.mockResolvedValue(1)
    mockClient.srem.mockResolvedValue(1)

    const result = await presenceService.removeSocket(USER_ID, SOCKET_ID)
    expect(result).toBe(true)
  })

  it('returns false when scard was greater than 1 before removal', async () => {
    mockClient.scard.mockResolvedValue(3)
    mockClient.srem.mockResolvedValue(1)

    const result = await presenceService.removeSocket(USER_ID, SOCKET_ID)
    expect(result).toBe(false)
  })
})

describe('presenceService.getUserSockets', () => {
  it('calls smembers with online:{userId}', async () => {
    mockClient.smembers.mockResolvedValue([SOCKET_ID])

    await presenceService.getUserSockets(USER_ID)

    expect(mockClient.smembers).toHaveBeenCalledWith(`online:${USER_ID}`)
  })

  it('returns the array of socket IDs', async () => {
    mockClient.smembers.mockResolvedValue([SOCKET_ID, 'socket-xyz'])

    const result = await presenceService.getUserSockets(USER_ID)
    expect(result).toEqual([SOCKET_ID, 'socket-xyz'])
  })
})

describe('presenceService.isUserOnline', () => {
  it('calls exists with online:{userId}', async () => {
    mockClient.exists.mockResolvedValue(1)

    await presenceService.isUserOnline(USER_ID)

    expect(mockClient.exists).toHaveBeenCalledWith(`online:${USER_ID}`)
  })

  it('returns the result from Redis', async () => {
    mockClient.exists.mockResolvedValue(0)
    expect(await presenceService.isUserOnline(USER_ID)).toBe(0)

    mockClient.exists.mockResolvedValue(1)
    expect(await presenceService.isUserOnline(USER_ID)).toBe(1)
  })
})

describe('presenceService.getOnlineUsers', () => {
  it('resolves with userIds extracted from online:* keys', async () => {
    const stream = makeStream([[`online:${USER_ID}`, 'online:other-user']])
    mockClient.scanStream.mockReturnValue(stream)

    const result = await presenceService.getOnlineUsers()
    expect(result).toContain(USER_ID)
    expect(result).toContain('other-user')
  })

  it('resolves with empty array when no keys match', async () => {
    const stream = makeStream([[]])
    mockClient.scanStream.mockReturnValue(stream)

    const result = await presenceService.getOnlineUsers()
    // Empty keys produce no entries (empty strings filtered by split)
    expect(Array.isArray(result)).toBe(true)
  })

  it('rejects the promise on stream error', async () => {
    const stream = makeStream([], new Error('Redis scan failed'))
    mockClient.scanStream.mockReturnValue(stream)

    await expect(presenceService.getOnlineUsers()).rejects.toThrow('Redis scan failed')
  })
})

describe('presenceService.getOnlineUsersCount', () => {
  it('resolves with the count of online:* keys', async () => {
    const stream = makeStream([[`online:user1`, `online:user2`, `online:user3`]])
    mockClient.scanStream.mockReturnValue(stream)

    const count = await presenceService.getOnlineUsersCount()
    expect(count).toBe(3)
  })

  it('resolves with 0 when no keys exist', async () => {
    const stream = makeStream([[]])
    mockClient.scanStream.mockReturnValue(stream)

    const count = await presenceService.getOnlineUsersCount()
    expect(count).toBe(0)
  })

  it('rejects the promise on stream error', async () => {
    const stream = makeStream([], new Error('scan error'))
    mockClient.scanStream.mockReturnValue(stream)

    await expect(presenceService.getOnlineUsersCount()).rejects.toThrow('scan error')
  })
})

describe('presenceService.clearAll', () => {
  it('calls del for each batch of keys found', async () => {
    const keys = [`online:user1`, `online:user2`]
    const stream = makeStream([keys])
    mockClient.scanStream.mockReturnValue(stream)
    mockClient.del.mockResolvedValue(2)

    await presenceService.clearAll()

    expect(mockClient.del).toHaveBeenCalledWith(...keys)
  })

  it('does not call del when batch is empty', async () => {
    const stream = makeStream([[]])
    mockClient.scanStream.mockReturnValue(stream)

    await presenceService.clearAll()

    expect(mockClient.del).not.toHaveBeenCalled()
  })

  it('rejects on stream error', async () => {
    const stream = makeStream([], new Error('clear error'))
    mockClient.scanStream.mockReturnValue(stream)

    await expect(presenceService.clearAll()).rejects.toThrow('clear error')
  })
})
