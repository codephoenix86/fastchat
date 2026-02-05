const { User } = require('@models')

class UserRepository {
  create(userData) {
    return User.create(userData)
  }

  findById(userId) {
    return User.findById(userId)
  }

  findByIdWithPassword(userId) {
    return User.findById(userId).select('+password')
  }

  findOne(query) {
    return User.findOne(query)
  }

  findOneWithPassword(query) {
    return User.findOne(query).select('+password')
  }

  findAll(query, options = {}) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 } } = options
    return User.find(query).sort(sort).skip(skip).limit(limit).select('-password')
  }

  countDocuments(query) {
    return User.countDocuments(query)
  }

  findByIdAndUpdate(userId, updateData, options = {}) {
    return User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    )
  }

  findByIdAndDelete(userId) {
    return User.findByIdAndDelete(userId)
  }
  deleteAvatar(userId) {
    return User.findByIdAndUpdate(
      userId,
      { $unset: { avatar: '' } },
      { new: true, runValidators: true }
    )
  }
  exists(query) {
    return User.exists(query)
  }
}

module.exports = new UserRepository()
