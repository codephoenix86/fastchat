const bcrypt = require('bcrypt')
const path = require('path')
const fs = require('fs').promises
const { userRepository } = require('@repositories')
const { logger } = require('@config')
const { NotFoundError, AuthenticationError, ConflictError } = require('@errors')

class UserService {
  /**
   * Create a new user
   */
  async createUser(userData) {
    try {
      const user = await userRepository.create(userData)
      logger.info('User created successfully', { userId: user._id })
      return this.formatUser(user)
    } catch (err) {
      if (err.code === 11000) {
        logger.error('Failed to create user:', {
          error: err.message,
          stack: err.stack,
          name: err.name,
        })
        if (err.keyPattern.email) {
          throw new ConflictError(
            'This email address is already registered. Please log in instead.',
            'EMAIL_ALREADY_EXISTS'
          )
        }
        if (err.keyPattern.username) {
          throw new ConflictError(
            'That username is already taken. Please try another one.',
            'USERNAME_ALREADY_TAKEN'
          )
        }
      }
      throw err
    }
  }

  /**
   * Find all users with pagination, filtering, and sorting
   * @param {Object} options - { filter, skip, limit, sort, search }
   */
  async findAllUsers(options = {}) {
    const { filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 }, search } = options

    // Build query filter
    const query = { ...filter }

    // Add search functionality
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    // Get total count for pagination
    const total = await userRepository.countDocuments(query)

    // Get users with pagination
    const users = await userRepository.findAll(query, { skip, limit, sort })

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
    return this.formatUser(user)
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData, oldPassword = null) {
    const user = await userRepository.findByIdWithPassword(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Verify old password if changing email or password
    if ((updateData.email || updateData.password) && oldPassword) {
      const isValid = await bcrypt.compare(oldPassword, user.password)
      if (!isValid) {
        throw new AuthenticationError('The password provided is incorrect', 'INVALID_PASSWORD')
      }
    }

    try {
      const updated = await userRepository.findByIdAndUpdate(userId, updateData, {
        runValidators: true,
      })

      logger.info('User updated successfully', { userId })
      return this.formatUser(updated)
    } catch (err) {
      if (err.code === 11000) {
        logger.error('Failed to update user:', {
          error: err.message,
          stack: err.stack,
          name: err.name,
        })
        if (err.keyPattern.email) {
          throw new ConflictError(
            'This email address is already registered. Please log in instead.',
            'EMAIL_ALREADY_EXISTS'
          )
        }
        if (err.keyPattern.username) {
          throw new ConflictError(
            'That username is already taken. Please try another one.',
            'USERNAME_ALREADY_TAKEN'
          )
        }
      }
      throw err
    }
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
        await fs.unlink(path.join('uploads/public/avatars', user.avatar))
        logger.info('Avatar file deleted', { userId })
      } catch (err) {
        logger.warn('Failed to delete avatar file', {
          userId,
          error: err.message,
          stack: err.stack,
          name: err.name,
        })
      }
    }

    await userRepository.findByIdAndDelete(userId)
    logger.info('User deleted successfully', { userId })
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId, filename) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Delete old avatar if exists
    if (user.avatar) {
      try {
        await fs.unlink(path.join('uploads/public/avatars', user.avatar))
        logger.info('Old avatar deleted from storage', { userId, filename: user.avatar })
      } catch (err) {
        logger.warn('Failed to delete old avatar file', {
          error: err.message,
          stack: err.stack,
          name: err.name,
          userId,
        })
      }
    }

    // Update avatar in database
    let updated
    if (filename === null) {
      // Use $unset to remove the field completely
      updated = await userRepository.deleteAvatar(userId)
    } else {
      // Set new avatar filename
      updated = await userRepository.findByIdAndUpdate(userId, { avatar: filename })
    }

    logger.info('User avatar updated', { userId, filename })
    return this.formatUser(updated)
  }

  /**
   * Change user password
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await userRepository.findByIdWithPassword(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password)
    if (!isValid) {
      throw new AuthenticationError('The password provided is incorrect', 'INVALID_PASSWORD')
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword
    await user.save()

    logger.info('Password changed successfully', { userId })
  }

  /**
   * Format user object for API response
   */
  formatUser(user) {
    if (!user) {
      return null
    }

    return {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}

module.exports = new UserService()
