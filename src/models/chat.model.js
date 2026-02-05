const mongoose = require('mongoose')
const { CHAT_TYPES } = require('@constants')

const schema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(CHAT_TYPES),
      required: true,
    },
    groupName: {
      type: String,
      required: function () {
        return this.type === CHAT_TYPES.GROUP
      },
      trim: true,
    },
    groupPicture: String,
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: function (value) {
          if (!Array.isArray(value)) {
            return false
          }
          if (this.type === CHAT_TYPES.GROUP) {
            return value.length >= 2
          }
          if (this.type === CHAT_TYPES.PRIVATE) {
            return value.length === 2
          }
          return false
        },
        message: 'Participants must be an array with valid number of users',
      },
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.type === CHAT_TYPES.GROUP
      },
    },
  },
  { timestamps: true }
)

// Indexes for performance
schema.index({ participants: 1, createdAt: -1 })
schema.index({ participants: 1, type: 1 })
schema.index({ admin: 1 })

// JSON transformation
schema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
    return ret
  },
})

module.exports = mongoose.model('Chat', schema)
