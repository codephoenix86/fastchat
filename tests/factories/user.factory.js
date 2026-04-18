const crypto = require('crypto')

const buildUser = (overrides = {}) => ({
  id: crypto.randomUUID(),
  username: 'testuser',
  email: 'test@example.com',
  password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567',
  role: 'user',
  avatar: null,
  bio: null,
  last_seen: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

module.exports = { buildUser }
