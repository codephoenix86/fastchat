const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const schema = new mongoose.Schema(
  {
    username: {
      type: String,
      match:
        /^(?=[^.]*\.?[^.]*$)[a-zA-Z](?!.*[_]{2})[a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/,
      required: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
      match:
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    ret.id = ret._id
    delete ret._id
    delete ret.password
    delete ret.__v
    return ret
  },
})

schema.methods.updateProfile = async function (data) {
  const allowedFields = ['username', 'password', 'avatar', 'email']
  for (const field of allowedFields) {
    if (data[field]) {
      console.log('updating', data[field])
      this[field] = data[field]
    }
  }
  await this.save()
}

schema.pre('save', async function (next) {
  if (!this.isModified()) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

module.exports = mongoose.model('User', schema)
