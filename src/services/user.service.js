const bcrypt = require('bcrypt')
const s3Service = require('./s3.service')
const { userRepository } = require('@repositories')
const { logger } = require('@config')
const { NotFoundError, AuthenticationError } = require('@errors')

class UserService {
  /**
   * Create a new user
   */
  async createUser(userData) {
    const user = await userRepository.create(userData)
    return this.formatUser(user)
  }
  async getUserByIdentifier(identifier) {
    const user = await userRepository.findByEmailOrUsername(identifier)
    return user
  }
  /**
   * Find all users with pagination, filtering, and sorting
   * @param {Object} options - { filter, skip, limit, sort, search }
   */
  async findAllUsers(options = {}) {
    const { filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 }, search } = options

    // Get total count for pagination
    const total = await userRepository.countDocuments(filter, search)

    // Get users with pagination
    const users = await userRepository.findAll(search, filter, { skip, limit, sort })

    return {
      users: users.map((user) => this.formatUser(user)),
      total,
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(userId) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return {
      id: user.id,
      username: user.username,
      bio: user.bio || undefined,
      lastSeen: user.last_seen,
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    const updatedUser = await userRepository.updateById(userId, updateData)
    return this.formatUser(updatedUser)
  }

  /**
   * Delete user account
   */
  async deleteUser(userId) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Delete user's avatar if exists
    if (user.avatar) {
      try {
        await s3Service.deleteFile(user.avatar)
      } catch (err) {
        // Non-fatal: proceed with account deletion even if S3 cleanup fails.
        logger.warn('Failed to delete avatar during user deletion', { userId, err })
      }
    }

    const deleted = await userRepository.findByIdAndDelete(userId)
    return this.formatUser(deleted)
  }

  async deleteAvatar(userId) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    if (user.avatar) {
      try {
        await s3Service.deleteFile(user.avatar)
      } catch (err) {
        logger.warn('Failed to delete avatar from storage', { userId, err })
        throw err
      }
    }
    const updated = await userRepository.deleteAvatar(userId)
    return this.formatUser(updated)
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId, file) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    if (user.avatar) {
      try {
        await s3Service.deleteFile(user.avatar)
      } catch (err) {
        // Non-fatal: old avatar cleanup failure should not block the upload.
        logger.warn('Failed to delete old avatar from storage', { userId, err })
      }
    }

    const filename = `${userId}-${Date.now()}`
    try {
      const url = await s3Service.uploadFile(file.buffer, filename, file.mimetype)
      const updated = await userRepository.updateById(userId, { avatar: url })
      return this.formatUser(updated)
    } catch (err) {
      logger.warn('Failed to upload avatar', { userId, err })
      throw err
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findByIdWithPassword(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Verify old password
    const match = await bcrypt.compare(currentPassword, user.password_hash)
    if (!match) {
      throw new AuthenticationError('The password provided is incorrect', 'INVALID_PASSWORD')
    }

    const password_hash = await bcrypt.hash(newPassword, 10)
    await userRepository.updateById(userId, { password_hash })

    logger.info('Password changed', { userId })
  }

  /**
   * Format user object for API response
   */
  formatUser(user) {
    if (!user) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar || undefined,
      bio: user.bio || undefined,
      lastSeen: user.last_seen || undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at || undefined,
    }
  }
}

module.exports = new UserService()
