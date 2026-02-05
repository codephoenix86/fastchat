const { RefreshToken } = require('@models')

class RefreshTokenRepository {
  create(tokenData) {
    return RefreshToken.create(tokenData)
  }

  findOne(query) {
    return RefreshToken.findOne(query)
  }

  deleteOne(query) {
    return RefreshToken.deleteOne(query)
  }

  exists(query) {
    return RefreshToken.exists(query)
  }
}

module.exports = new RefreshTokenRepository()
