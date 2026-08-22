const { redis } = require('@config')
const client = redis.getClient()

class PresenceService {
  async addSocket(userId, socketId) {
    const key = `online:${userId}`
    await client.sadd(key, socketId)
    const count = await client.scard(key)
    if (count === 1) {
      await client.sadd('online_users', userId)
    }
    return count === 1 // isFirstConnection
  }

  async removeSocket(userId, socketId) {
    const key = `online:${userId}`
    const count = await client.scard(key)
    await client.srem(key, socketId)
    if (count === 1) {
      await client.srem('online_users', userId)
    }
    return count === 1 // isLastConnection
  }
  async getUserSockets(userId) {
    const key = `online:${userId}`
    const sockets = await client.smembers(key)
    return sockets
  }
  async isUserOnline(userId) {
    const status = await client.sismember('online_users', userId)
    return status
  }
  async areUsersOnline(userIds) {
    const statuses = await client.smismember('online_users', ...userIds)
    return statuses
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
