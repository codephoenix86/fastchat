const mongoose = require('mongoose')
const crypto = require('crypto')
const { CHAT_TYPES } = require('@constants')

const participantSchema = new mongoose.Schema(
  {
    user: String,
    latestSequence: {
      type: Number,
      required: true,
      default: 0,
    },
    lastClear: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const schema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
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
    chatKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    participants: {
      type: [participantSchema],
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
    lastReadSequence: {
      type: Number,
      required: true,
      default: 0,
    },
    admin: {
      type: String,
      required: function () {
        return this.type === CHAT_TYPES.GROUP
      },
    },
    lastMessage: {
      type: String,
      ref: 'Message',
    },
    lastMessageAt: Date,
  },
  { timestamps: true }
)

// Indexes for performance
schema.index({ 'participants.user': 1, updatedAt: -1 })
schema.index({ 'participants.user': 1, type: 1 })
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
