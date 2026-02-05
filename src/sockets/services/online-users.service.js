const { logger } = require('@config')

/**
 * Service to manage online users and their socket connections
 * In-memory store: { userId: Set([socketId1, socketId2, ...]) }
 */
class OnlineUsersService {
  constructor() {
    this.onlineUsers = {}
  }

  /**
   * Add a socket connection for a user
   * @param {String} userId - User ID
   * @param {String} socketId - Socket ID
   * @returns {Boolean} - True if this is the user's first connection
   */
  addSocket(userId, socketId) {
    const isFirstConnection = !this.isUserOnline(userId)

    if (!this.onlineUsers[userId]) {
      this.onlineUsers[userId] = new Set()
    }
    this.onlineUsers[userId].add(socketId)

    logger.debug('Socket added', {
      userId,
      socketId,
      totalSockets: this.onlineUsers[userId].size,
      isFirstConnection,
    })

    return isFirstConnection
  }

  /**
   * Remove a socket connection for a user
   * @param {String} userId - User ID
   * @param {String} socketId - Socket ID
   * @returns {Boolean} - True if this was the user's last connection
   */
  removeSocket(userId, socketId) {
    if (!this.onlineUsers[userId]) {
      return false
    }

    this.onlineUsers[userId].delete(socketId)

    const isLastConnection = this.onlineUsers[userId].size === 0
    if (isLastConnection) {
      delete this.onlineUsers[userId]
    }

    logger.debug('Socket removed', {
      userId,
      socketId,
      remainingSockets: this.onlineUsers[userId]?.size || 0,
      isLastConnection,
    })

    return isLastConnection
  }

  /**
   * Get all socket IDs for a user
   * @param {String} userId - User ID
   * @returns {Set} - Set of socket IDs
   */
  getUserSockets(userId) {
    return this.onlineUsers[userId] || new Set()
  }

  /**
   * Check if user is online (has at least one active socket)
   * @param {String} userId - User ID
   * @returns {Boolean}
   */
  isUserOnline(userId) {
    return this.onlineUsers[userId] && this.onlineUsers[userId].size > 0
  }

  /**
   * Get all online user IDs
   * @returns {Array<String>}
   */
  getOnlineUserIds() {
    return Object.keys(this.onlineUsers)
  }

  /**
   * Get total count of online users
   * @returns {Number}
   */
  getOnlineCount() {
    return Object.keys(this.onlineUsers).length
  }

  /**
   * Get total count of active socket connections
   * @returns {Number}
   */
  getTotalConnections() {
    return Object.values(this.onlineUsers).reduce((total, sockets) => total + sockets.size, 0)
  }

  /**
   * Clear all connections (for testing/cleanup)
   */
  clear() {
    this.onlineUsers = {}
    logger.info('All online users cleared')
  }
}

// Export singleton instance
module.exports = new OnlineUsersService()
