const bcrypt = require('bcrypt')
const s3Service = require('./s3.service')
const { userRepository } = require('@repositories')
const { logger } = require('@config')
const { NotFoundError, AuthenticationError } = require('@errors')

class UserService {
  async create(userData) {
    const user = await userRepository.create(userData)
    return user
  }

  async existAll(userIds) {
    const isAllUsersExist = await userRepository.existAll(userIds)
    return isAllUsersExist
  }

  async findByIdentifier(identifier) {
    const user = await userRepository.findByEmailOrUsername(identifier, true)
    return user
  }

  async findAll(options = {}) {
    const { skip, limit, query } = options

    let users
    if (query) {
      users = await userRepository.search(query)
    } else {
      users = await userRepository.findAll({
        skip,
        limit: limit ? limit + 1 : undefined,
      })
    }

    if (users.length === 0) {
      throw new NotFoundError('Users not found')
    }

    const hasNextPage = query ? false : users.length > limit
    if (hasNextPage) {
      users.pop()
    }
    return {
      users,
      hasNextPage,
    }
  }

  async findById(userId) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return user
  }

  async updateById(userId, updateData) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    const updatedUser = await userRepository.updateById(userId, updateData)
    return updatedUser
  }

  async deleteById(userId) {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    if (user.avatar) {
      try {
        await s3Service.deleteFile(user.avatar)
      } catch (err) {
        logger.warn('Failed to delete avatar during user deletion', { userId, err })
      }
    }

    const deletedUser = await userRepository.deleteById(userId)
    return deletedUser
  }

  async deleteAvatar(userId) {
    const updatedUser = await userRepository.deleteAvatar(userId)
    if (!updatedUser) {
      throw new NotFoundError('User not found')
    }
    return updatedUser
  }

  async updateAvatar(userId, url) {
    const updatedUser = await userRepository.uploadAvatar(userId, url)
    if (!updatedUser) {
      throw new NotFoundError('User not found')
    }
    return updatedUser
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findById(userId, true)
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

  async updateLastSeen(userId) {
    const updatedUser = await userRepository.updateLastSeen(userId)
    if (!updatedUser) {
      throw new NotFoundError('User not found')
    }
    return updatedUser
  }
}

module.exports = new UserService()
