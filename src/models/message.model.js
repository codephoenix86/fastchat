const mongoose = require('mongoose')
const crypto = require('crypto')
const { MESSAGE_TYPES, MESSAGE_STATUS } = require('@constants')

const schema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    content: {
      type: String,
      required: function () {
        return this.type === MESSAGE_TYPES.TEXT
      },
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MESSAGE_STATUS),
      default: MESSAGE_STATUS.SENT,
    },
    sender: {
      type: String,
      required: true,
    },
    chat: {
      type: String,
      ref: 'Chat',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      default: MESSAGE_TYPES.TEXT,
    },
    file: {
      type: {
        url: String,
        filename: String,
        mimetype: String,
      },
      required: function () {
        return this.type === MESSAGE_TYPES.FILE
      },
    },
  },
  { timestamps: true }
)

// Indexes for performance
schema.index({ chat: 1, createdAt: -1 })
schema.index({ sender: 1, createdAt: -1 })
schema.index({ status: 1, chat: 1 })

// JSON transformation
schema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
    return ret
  },
})

module.exports = mongoose.model('Message', schema)
