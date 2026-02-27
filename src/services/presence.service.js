const { redis } = require('@config')
const { logger } = require('@config')
const client = redis.getClient()
class PresenceService {
  async addSocket(userId, socketId) {
    const key = `online:${userId}`
    await client.sadd(key, socketId)
    const count = await client.scard(key)
    const isFirstConnection = count === 1
    logger.debug('Socket added', {
      userId,
      socketId,
      isFirstConnection,
    })
    return isFirstConnection
  }
  async removeSocket(userId, socketId) {
    const key = `online:${userId}`
    const count = await client.scard(key)
    await client.srem(key, socketId)
    const isLastConnection = count === 1
    logger.debug('Socket removed', {
      userId,
      socketId,
      isLastConnection,
    })
    return isLastConnection
  }
  async getUserSockets(userId) {
    const key = `online:${userId}`
    const sockets = await client.smembers(key)
    return sockets
  }
  async isUserOnline(userId) {
    const key = `online:${userId}`
    const result = await client.exists(key)
    return result
  }
  getOnlineUsers() {
    const users = []
    const stream = client.scanStream({
      match: 'online:*',
      count: 100,
    })
    stream.on('data', (keys) => {
      const userIds = keys.map((key) => key.split(':')[1])
      users.push(...userIds)
    })
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(err))
      stream.on('end', () => resolve(users))
    })
  }
  getOnlineUsersCount() {
    let count = 0
    const stream = client.scanStream({
      match: 'online:*',
      count: 100,
    })
    stream.on('data', (keys) => {
      count += keys.length
    })
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(err))
      stream.on('end', () => resolve(count))
    })
  }
  clearAll() {
    const stream = client.scanStream({
      match: 'online:*',
      count: 100,
    })
    stream.on('data', async (keys) => {
      if (keys.length > 0) {
        stream.pause()
        await client.del(...keys)
        stream.resume()
      }
    })
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(err))
      stream.on('end', () => resolve())
    })
  }
}

module.exports = new PresenceService()
