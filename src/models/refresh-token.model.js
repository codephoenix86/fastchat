const mongoose = require('mongoose')
const ms = require('ms')

const { env } = require('@config')

const schema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: Math.floor(ms(env.JWT_REFRESH_EXPIRES || '7d') / 1000),
  },
})

// Indexes
schema.index({ user: 1, refreshToken: 1 })

module.exports = mongoose.model('RefreshToken', schema)
