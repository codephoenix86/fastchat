const bcrypt = require('bcrypt')
const { tokenService } = require('@services')
const { postgres } = require('@config')
const pool = postgres.getPool()
const { generateUsername, generateEmail } = require('./generators')

const createTestUser = async (overrides = {}) => {
  const userData = {
    username: generateUsername(),
    email: generateEmail(),
    password: 'Password@123',
    ...overrides,
  }

  const userStatement =
    'INSERT INTO users(username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *'
  const { username, email, password, role = 'user' } = userData
  const hashed_password = await bcrypt.hash(password, 10)
  const userResult = await pool.query(userStatement, [username, email, hashed_password, role])

  const { bio = null, avatar = null, last_seen = new Date() } = userData
  const profileStatement =
    'INSERT INTO profiles(user_id, bio, avatar, last_seen) VALUES ($1, $2, $3, $4) RETURNING *'
  const profileResult = await pool.query(profileStatement, [
    userResult.rows[0].id,
    bio,
    avatar,
    last_seen,
  ])

  const user = {
    id: userResult.rows[0].id,
    username: userResult.rows[0].username,
    email: userResult.rows[0].email,
    password_hash: userResult.rows[0].password_hash,
    role: userResult.rows[0].role,
    bio: profileResult.rows[0].bio,
    avatar: profileResult.rows[0].avatar,
    last_seen: profileResult.rows[0].last_seen,
    created_at: userResult.rows[0].created_at,
    updated_at: profileResult.rows[0].updated_at,
  }

  const tokens = await tokenService.issueTokenPair(user)

  return { user, tokens }
}

const createTestUsers = async (count = 2) => {
  const users = []
  for (let i = 0; i < count; i++) {
    const testUser = await createTestUser()
    users.push(testUser)
  }
  return users
}

module.exports = { createTestUser, createTestUsers }
