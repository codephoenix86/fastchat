const { postgres } = require('@config')
const { ConflictError, ValidationError } = require('@errors')
const pool = postgres.getPool()
class UserRepository {
  _isUuid(value) {
    if (typeof value !== 'string') {
      return false
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  _assertUuid(value, field = 'id') {
    if (!this._isUuid(value)) {
      throw new ValidationError(`Invalid ${field} format. Must be a valid UUID.`, 'INVALID_UUID')
    }
  }

  _assertUuidArray(values, field = 'id') {
    if (!Array.isArray(values)) {
      throw new ValidationError(`${field} must be an array`, 'BAD_REQUEST')
    }
    values.forEach((v) => this._assertUuid(v, field))
  }

  _normalizeUserFilters(filters) {
    const allowed = new Set(['id', 'username', 'email', 'role'])
    const safe = {}
    if (!filters || typeof filters !== 'object') {
      return safe
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (!allowed.has(key)) {
        return
      }
      if (value === undefined) {
        return
      }
      safe[key] = value
    })

    return safe
  }

  async create(userData) {
    const { email, username, password_hash } = userData
    const userStatement =
      'INSERT INTO users(email, username, password_hash) VALUES($1,$2,$3) RETURNING *'
    const profileStatement = 'INSERT INTO profiles(user_id) VALUES ($1)'
    try {
      const result = await pool.query(userStatement, [email, username, password_hash])
      await pool.query(profileStatement, [result.rows[0].id])
      return result.rows[0]
    } catch (err) {
      if (err.code === '23505') {
        if (err.constraint.includes('email')) {
          throw new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
        }
        if (err.constraint.includes('username')) {
          throw new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
        }
      }
      throw err
    }
  }
  async findByEmailOrUsername(identifier) {
    const statement =
      'SELECT id, username, email, role, password_hash FROM users WHERE email = $1 OR username = $1'
    const result = await pool.query(statement, [identifier])
    return result.rows[0] || null
  }
  async findById(userId) {
    this._assertUuid(userId, 'userId')
    const statement =
      'SELECT users.id, users.username, users.email, users.role, profiles.bio, profiles.avatar, profiles.last_seen, users.created_at, profiles.updated_at FROM users LEFT JOIN profiles ON users.id = profiles.user_id WHERE users.id = $1'
    const result = await pool.query(statement, [userId])
    return result.rows[0]
  }

  async findByIdWithPassword(userId) {
    this._assertUuid(userId, 'userId')
    const statement =
      'SELECT users.id, users.username, users.email, users.password_hash, users.role, profiles.bio, profiles.avatar, profiles.last_seen, users.created_at, profiles.updated_at FROM users LEFT JOIN profiles ON users.id = profiles.user_id WHERE users.id = $1'
    const result = await pool.query(statement, [userId])
    return result.rows[0]
  }

  async findOneWithPassword(query) {
    const statement =
      'SELECT id, username, email, password_hash, role FROM users WHERE username = $1 OR email = $1'
    const value = query.username || query.email
    const result = await pool.query(statement, [value])
    return result.rows[0]
  }

  _normalizeSortForUserList(sort) {
    const allowed = new Set(['username', 'email', 'created_at'])
    const toSqlColumn = (key) => (key === 'createdAt' ? 'created_at' : key)

    let pairs = []
    if (Array.isArray(sort)) {
      pairs = sort.map(([field, direction]) => [toSqlColumn(field), direction])
    } else if (sort && typeof sort === 'object') {
      pairs = Object.entries(sort).map(([field, direction]) => [toSqlColumn(field), direction])
    }

    pairs = pairs.filter(([field]) => allowed.has(field))
    if (pairs.length === 0) {
      pairs = [['created_at', -1]]
    }
    return pairs
  }

  async findAll(query, filters, options = {}) {
    const { skip = 0, limit = 20, sort } = options
    const safeSkip = Number.isFinite(+skip) ? Math.max(0, parseInt(skip, 10)) : 0
    const safeLimit = Number.isFinite(+limit) ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20
    const conditions = []
    const params = []

    const safeFilters = this._normalizeUserFilters(filters)
    Object.entries(safeFilters).forEach(([key, value]) => {
      params.push(value)
      conditions.push(`users.${key} = $${params.length}`)
    })

    if (query) {
      params.push(query)
      conditions.push(`(users.username ~* $${params.length} OR users.email ~* $${params.length})`)
    }

    const sortPairs = this._normalizeSortForUserList(sort)
    const sortings = []
    sortPairs.forEach(([key, value]) => {
      sortings.push(`users.${key} ${value === 1 ? 'ASC' : 'DESC'}`)
    })

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortClause = sortings.length > 0 ? `ORDER BY ${sortings.join(', ')}` : ''
    const statement = `SELECT users.id, users.username, users.email, users.password_hash, users.role, profiles.bio, profiles.avatar, profiles.last_seen, users.created_at, profiles.updated_at FROM users LEFT JOIN profiles ON users.id = profiles.user_id ${whereClause} ${sortClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

    params.push(safeLimit, safeSkip)
    const result = await pool.query(statement, params)
    return result.rows
  }

  async contains(arr) {
    if (!arr || arr.length === 0) {
      return true
    }

    this._assertUuidArray(arr, 'userId')
    const placeholders = arr.map((_, i) => `$${i + 1}`).join(', ')
    const statement = `SELECT COUNT(*) FROM users WHERE id IN (${placeholders})`
    const result = await pool.query(statement, arr)
    return parseInt(result.rows[0].count, 10) === arr.length
  }
  async countDocuments(filters, query) {
    const conditions = []
    const params = []

    const safeFilters = this._normalizeUserFilters(filters)
    Object.entries(safeFilters).forEach(([key, value]) => {
      params.push(value)
      conditions.push(`users.${key} = $${params.length}`)
    })

    if (query) {
      params.push(query)
      conditions.push(`(users.username ~* $${params.length} OR users.email ~* $${params.length})`)
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const statement = `SELECT COUNT(*) FROM users ${whereClause}`
    const result = await pool.query(statement, params)
    return parseInt(result.rows[0].count)
  }

  async updateById(userId, updateData) {
    this._assertUuid(userId, 'userId')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const userFields = []
      const userValues = []
      let paramIndex = 1
      if (updateData.username) {
        userFields.push(`username = $${paramIndex++}`)
        userValues.push(updateData.username)
      }
      if (updateData.email) {
        userFields.push(`email = $${paramIndex++}`)
        userValues.push(updateData.email)
      }
      if (updateData.password_hash) {
        userFields.push(`password_hash = $${paramIndex++}`)
        userValues.push(updateData.password_hash)
      }

      if (userFields.length > 0) {
        userValues.push(userId)

        const queryText = `
        UPDATE users 
        SET ${userFields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING id, username, email, role, created_at
      `

        await client.query(queryText, userValues)
      }

      paramIndex = 1
      const profileFields = []
      const profileValues = []

      if (updateData.bio) {
        profileFields.push(`bio = $${paramIndex++}`)
        profileValues.push(updateData.bio)
      }

      if (updateData.avatar) {
        profileFields.push(`avatar = $${paramIndex++}`)
        profileValues.push(updateData.avatar)
      }

      if (profileFields.length > 0) {
        profileValues.push(userId)

        const queryText = `UPDATE profiles SET ${profileFields.join(', ')} WHERE user_id = $${paramIndex} RETURNING bio, avatar`
        await client.query(queryText, profileValues)
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') {
        if (err.constraint.includes('email')) {
          throw new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
        }
        if (err.constraint.includes('username')) {
          throw new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
        }
      }
      throw err
    } finally {
      client.release()
    }
    const result = await pool.query(
      'SELECT users.id, users.username, users.email, users.password_hash, users.role, profiles.bio, profiles.avatar, profiles.last_seen, users.created_at, profiles.updated_at FROM users LEFT JOIN profiles ON users.id = profiles.user_id WHERE users.id = $1',
      [userId]
    )
    return result.rows[0]
  }

  async findByIdAndDelete(userId) {
    this._assertUuid(userId, 'userId')
    const result = await pool.query('DELETE FROM users where id = $1 RETURNING *', [userId])
    return result.rows[0]
  }
  async deleteAvatar(userId) {
    this._assertUuid(userId, 'userId')
    const statement = 'UPDATE profiles SET avatar = NULL WHERE user_id = $1 RETURNING *'
    const result = await pool.query(statement, [userId])
    return result.rows[0]
  }
}

module.exports = new UserRepository()
