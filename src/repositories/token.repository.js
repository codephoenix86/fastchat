const { redis } = require('@config')
const client = redis.getClient()

class TokenRepository {
  _buildKey(token) {
    return `rt:${token}`
  }

  async save(token, userId, expiresInSeconds) {
    const key = this._buildKey(token)
    // Value is the userId, allowing us to identify who owns this token
    await client.set(key, userId, 'EX', expiresInSeconds)
  }

  async getUserIdByToken(token) {
    const key = this._buildKey(token)
    const user = await client.get(key)
    return user
  }

  async delete(token) {
    const key = this._buildKey(token)
    await client.del(key)
  }
}

module.exports = new TokenRepository()
