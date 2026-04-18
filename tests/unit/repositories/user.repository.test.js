const crypto = require('crypto')
const { ConflictError, ValidationError: _ValidationError } = require('@errors')

jest.mock('@config', () => {
  const mockPool = { query: jest.fn(), connect: jest.fn() }
  return { postgres: { getPool: () => mockPool } }
})

const userRepository = require('@repositories/user.repository')
const { postgres } = require('@config')
const pool = postgres.getPool()

const makeUserRow = (overrides = {}) => ({
  id: crypto.randomUUID(),
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  bio: null,
  avatar: null,
  last_seen: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

describe('userRepository', () => {
  beforeEach(() => {
    pool.query.mockReset()
    pool.connect.mockReset()
  })

  // ─── _isUuid / _assertUuid ───────────────────────────────────────────────

  describe('_isUuid (tested via findById)', () => {
    it('rejects invalid UUIDs without querying the database', async () => {
      await expect(userRepository.findById('nope')).rejects.toMatchObject({ code: 'INVALID_UUID' })
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('rejects an empty string as UUID', async () => {
      await expect(userRepository.findById('')).rejects.toMatchObject({ code: 'INVALID_UUID' })
    })

    it('rejects a partial UUID', async () => {
      await expect(userRepository.findById('abc-123')).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
    })

    it('accepts a valid UUID and queries the database', async () => {
      const userId = crypto.randomUUID()
      pool.query.mockResolvedValue({ rows: [makeUserRow({ id: userId })] })
      const result = await userRepository.findById(userId)
      expect(pool.query).toHaveBeenCalledTimes(1)
      expect(result.id).toBe(userId)
    })

    it('returns null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      const result = await userRepository.findById(crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ─── findByIdWithPassword ─────────────────────────────────────────────────

  describe('findByIdWithPassword', () => {
    it('rejects non-UUID userId', async () => {
      await expect(userRepository.findByIdWithPassword('bad')).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
    })

    it('returns user row including password_hash', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId, password_hash: 'hashed' })
      pool.query.mockResolvedValue({ rows: [row] })
      const result = await userRepository.findByIdWithPassword(userId)
      expect(result.password_hash).toBe('hashed')
    })

    it('returns null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      const result = await userRepository.findByIdWithPassword(crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ─── findByEmailOrUsername ────────────────────────────────────────────────

  describe('findByEmailOrUsername', () => {
    it('queries by the provided identifier', async () => {
      const row = makeUserRow({ email: 'alice@example.com' })
      pool.query.mockResolvedValue({ rows: [row] })
      const result = await userRepository.findByEmailOrUsername('alice@example.com')
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['alice@example.com'])
      expect(result.email).toBe('alice@example.com')
    })

    it('returns null when no user matches', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      const result = await userRepository.findByEmailOrUsername('nobody@example.com')
      expect(result).toBeNull()
    })
  })

  // ─── findOneWithPassword ──────────────────────────────────────────────────

  describe('findOneWithPassword', () => {
    it('queries with username when provided', async () => {
      const row = makeUserRow({ username: 'alice' })
      pool.query.mockResolvedValue({ rows: [row] })
      await userRepository.findOneWithPassword({ username: 'alice' })
      const [, params] = pool.query.mock.calls[0]
      expect(params[0]).toBe('alice')
    })

    it('queries with email when username not provided', async () => {
      const row = makeUserRow({ email: 'alice@example.com' })
      pool.query.mockResolvedValue({ rows: [row] })
      await userRepository.findOneWithPassword({ email: 'alice@example.com' })
      const [, params] = pool.query.mock.calls[0]
      expect(params[0]).toBe('alice@example.com')
    })
  })

  // ─── contains ─────────────────────────────────────────────────────────────

  describe('contains', () => {
    it('short-circuits for an empty list', async () => {
      await expect(userRepository.contains([])).resolves.toBe(true)
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('short-circuits for a null/undefined list', async () => {
      await expect(userRepository.contains(null)).resolves.toBe(true)
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('uses bound params in the IN clause', async () => {
      const a = crypto.randomUUID()
      const b = crypto.randomUUID()
      pool.query.mockResolvedValue({ rows: [{ count: '2' }] })
      await userRepository.contains([a, b])
      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).toMatch(/IN \(\$1, \$2\)/)
      expect(params).toEqual([a, b])
    })

    it('returns true when all UUIDs match', async () => {
      const ids = [crypto.randomUUID(), crypto.randomUUID()]
      pool.query.mockResolvedValue({ rows: [{ count: '2' }] })
      expect(await userRepository.contains(ids)).toBe(true)
    })

    it('returns false when count is less than array length', async () => {
      const ids = [crypto.randomUUID(), crypto.randomUUID()]
      pool.query.mockResolvedValue({ rows: [{ count: '1' }] })
      expect(await userRepository.contains(ids)).toBe(false)
    })

    it('rejects invalid UUIDs in the array', async () => {
      await expect(userRepository.contains(['x'])).rejects.toMatchObject({ code: 'INVALID_UUID' })
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('rejects if array contains a mix of valid and invalid UUIDs', async () => {
      await expect(
        userRepository.contains([crypto.randomUUID(), 'not-uuid'])
      ).rejects.toMatchObject({ code: 'INVALID_UUID' })
    })

    it('rejects when _assertUuidArray receives a non-array (BAD_REQUEST)', async () => {
      await expect(userRepository.contains('not-an-array')).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
    })
  })

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns rows from query result', async () => {
      const rows = [makeUserRow(), makeUserRow()]
      pool.query.mockResolvedValue({ rows })
      const result = await userRepository.findAll(undefined, {})
      expect(result).toEqual(rows)
    })

    it('maps mongo-style sort objects to SQL ORDER BY DESC', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { sort: { createdAt: -1 } })
      const [sql] = pool.query.mock.calls[0]
      expect(sql).toMatch(/ORDER BY users\.created_at DESC/)
    })

    it('maps mongo-style sort objects to SQL ORDER BY ASC', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { sort: { createdAt: 1 } })
      const [sql] = pool.query.mock.calls[0]
      expect(sql).toMatch(/ORDER BY users\.created_at ASC/)
    })

    it('handles array-style sort pairs', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { sort: [['username', 1]] })
      const [sql] = pool.query.mock.calls[0]
      expect(sql).toMatch(/ORDER BY users\.username ASC/)
    })

    it('defaults to created_at DESC when sort is not provided', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {})
      const [sql] = pool.query.mock.calls[0]
      expect(sql).toMatch(/ORDER BY users\.created_at DESC/)
    })

    it('ignores unknown sort fields', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { sort: { passwordHash: -1 } })
      const [sql] = pool.query.mock.calls[0]
      // Falls back to default sort
      expect(sql).toMatch(/ORDER BY users\.created_at DESC/)
    })

    it('ignores unknown filter keys', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, { role: 'admin', dropTable: '1' })
      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).not.toMatch(/dropTable/)
      expect(sql).toMatch(/users\.role/)
      expect(params).toContain('admin')
    })

    it('applies text search query to WHERE clause', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll('alice', {})
      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).toMatch(/username ~\*/)
      expect(params).toContain('alice')
    })

    it('rejects invalid role values', async () => {
      await expect(userRepository.findAll(undefined, { role: 'superadmin' })).rejects.toMatchObject(
        {
          code: 'INVALID_ROLE',
        }
      )
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('rejects non-UUID id filters', async () => {
      await expect(userRepository.findAll(undefined, { id: 'not-a-uuid' })).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('accepts a valid UUID id filter', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, { id: crypto.randomUUID() })
      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('clamps limit above 100 to 100', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { limit: 9999 })
      const args = pool.query.mock.calls[0][1]
      expect(args[args.length - 2]).toBe(100)
    })

    it('clamps limit below 1 to 1', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { limit: -5 })
      const args = pool.query.mock.calls[0][1]
      expect(args[args.length - 2]).toBe(1)
    })

    it('clamps negative skip to 0', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, {}, { skip: -3 })
      const args = pool.query.mock.calls[0][1]
      expect(args[args.length - 1]).toBe(0)
    })

    it('handles null filters gracefully', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, null)
      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('handles non-object filters gracefully', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      await userRepository.findAll(undefined, 'bad-filter')
      expect(pool.query).toHaveBeenCalledTimes(1)
    })
  })

  // ─── countDocuments ────────────────────────────────────────────────────────

  describe('countDocuments', () => {
    it('returns the total count', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '7' }] })
      const result = await userRepository.countDocuments({}, undefined)
      expect(result).toBe(7)
    })

    it('applies query search to WHERE clause', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '3' }] })
      await userRepository.countDocuments({}, 'bob')
      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).toMatch(/username ~\*/)
      expect(params).toContain('bob')
    })

    it('returns 0 when no users match', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] })
      const result = await userRepository.countDocuments({}, undefined)
      expect(result).toBe(0)
    })
  })

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts user and profile, returns user row', async () => {
      const row = makeUserRow({ email: 'new@example.com', username: 'newuser' })
      pool.query
        .mockResolvedValueOnce({ rows: [row] }) // users insert
        .mockResolvedValueOnce({ rows: [] }) // profiles insert
      const result = await userRepository.create({
        email: 'new@example.com',
        username: 'newuser',
        password_hash: 'hashed',
      })
      expect(pool.query).toHaveBeenCalledTimes(2)
      expect(result).toEqual(row)
    })

    it('maps a duplicate email constraint violation to ConflictError', async () => {
      const err = Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'users_email_key',
      })
      pool.query.mockRejectedValueOnce(err)
      await expect(
        userRepository.create({ email: 'a@b.com', username: 'u', password_hash: 'h' })
      ).rejects.toThrow(ConflictError)
    })

    it('maps a duplicate username constraint violation to ConflictError', async () => {
      const err = Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'users_username_key',
      })
      pool.query.mockRejectedValueOnce(err)
      await expect(
        userRepository.create({ email: 'b@b.com', username: 'taken', password_hash: 'h' })
      ).rejects.toThrow(ConflictError)
    })

    it('re-throws unknown database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('unexpected db error'))
      await expect(
        userRepository.create({ email: 'c@c.com', username: 'u2', password_hash: 'h' })
      ).rejects.toThrow('unexpected db error')
    })
  })

  // ─── updateById ────────────────────────────────────────────────────────────

  describe('updateById', () => {
    it('rejects non-UUID userId', async () => {
      await expect(userRepository.updateById('bad', { username: 'x' })).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
    })

    it('returns current row without DB transaction when no user or profile fields', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId })
      pool.query.mockResolvedValue({ rows: [row] })
      const result = await userRepository.updateById(userId, {})
      // Should only call the SELECT, no BEGIN/COMMIT
      expect(pool.connect).not.toHaveBeenCalled()
      expect(result).toEqual(row)
    })

    it('commits transaction on successful user field update', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId, username: 'newname' })
      const clientQuery = jest.fn().mockResolvedValue({ rows: [row] })
      const release = jest.fn()
      pool.connect.mockResolvedValue({ query: clientQuery, release })
      pool.query.mockResolvedValue({ rows: [row] })

      const result = await userRepository.updateById(userId, { username: 'newname' })

      const calls = clientQuery.mock.calls.map((c) => c[0])
      expect(calls).toContain('BEGIN')
      expect(calls).toContain('COMMIT')
      expect(calls).not.toContain('ROLLBACK')
      expect(release).toHaveBeenCalled()
      expect(result).toEqual(row)
    })

    it('commits transaction on successful profile field update', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId, bio: 'new bio' })
      const clientQuery = jest.fn().mockResolvedValue({ rows: [row] })
      const release = jest.fn()
      pool.connect.mockResolvedValue({ query: clientQuery, release })
      pool.query.mockResolvedValue({ rows: [row] })

      await userRepository.updateById(userId, { bio: 'new bio' })

      const calls = clientQuery.mock.calls.map((c) => c[0])
      expect(calls).toContain('BEGIN')
      expect(calls).toContain('COMMIT')
      expect(release).toHaveBeenCalled()
    })

    it('rolls back the transaction when an update fails', async () => {
      const userId = crypto.randomUUID()
      const clientQuery = jest.fn().mockImplementation((sql) => {
        if (sql === 'BEGIN') {
          return Promise.resolve()
        }
        if (String(sql).includes('UPDATE users')) {
          return Promise.reject(new Error('db went sideways'))
        }
        if (sql === 'ROLLBACK') {
          return Promise.resolve()
        }
        return Promise.resolve()
      })
      pool.connect.mockResolvedValue({ query: clientQuery, release: jest.fn() })
      await expect(userRepository.updateById(userId, { username: 'newname' })).rejects.toThrow(
        'db went sideways'
      )
      expect(clientQuery.mock.calls.map((c) => c[0])).toContain('ROLLBACK')
    })

    it('maps duplicate email error on update to ConflictError', async () => {
      const userId = crypto.randomUUID()
      const duplicateErr = Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'users_email_key',
      })
      const clientQuery = jest.fn().mockImplementation((sql) => {
        if (sql === 'BEGIN') {
          return Promise.resolve()
        }
        if (String(sql).includes('UPDATE users')) {
          return Promise.reject(duplicateErr)
        }
        if (sql === 'ROLLBACK') {
          return Promise.resolve()
        }
        return Promise.resolve()
      })
      pool.connect.mockResolvedValue({ query: clientQuery, release: jest.fn() })
      await expect(userRepository.updateById(userId, { email: 'taken@test.com' })).rejects.toThrow(
        ConflictError
      )
    })

    it('maps duplicate username error on update to ConflictError', async () => {
      const userId = crypto.randomUUID()
      const duplicateErr = Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'users_username_key',
      })
      const clientQuery = jest.fn().mockImplementation((sql) => {
        if (sql === 'BEGIN') {
          return Promise.resolve()
        }
        if (String(sql).includes('UPDATE users')) {
          return Promise.reject(duplicateErr)
        }
        if (sql === 'ROLLBACK') {
          return Promise.resolve()
        }
        return Promise.resolve()
      })
      pool.connect.mockResolvedValue({ query: clientQuery, release: jest.fn() })
      await expect(userRepository.updateById(userId, { username: 'taken' })).rejects.toThrow(
        ConflictError
      )
    })

    it('always releases the client even when transaction fails', async () => {
      const userId = crypto.randomUUID()
      const release = jest.fn()
      const clientQuery = jest.fn().mockImplementation((sql) => {
        if (sql === 'BEGIN') {
          return Promise.resolve()
        }
        return Promise.reject(new Error('crash'))
      })
      pool.connect.mockResolvedValue({ query: clientQuery, release })
      await expect(userRepository.updateById(userId, { username: 'x' })).rejects.toThrow('crash')
      expect(release).toHaveBeenCalled()
    })
  })

  // ─── findByIdAndDelete ─────────────────────────────────────────────────────

  describe('findByIdAndDelete', () => {
    it('rejects non-UUID userId', async () => {
      await expect(userRepository.findByIdAndDelete('bad')).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
    })

    it('deletes user and returns deleted row', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId })
      pool.query.mockResolvedValue({ rows: [row] })
      const result = await userRepository.findByIdAndDelete(userId)
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), [userId])
      expect(result).toEqual(row)
    })

    it('returns null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      const result = await userRepository.findByIdAndDelete(crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ─── deleteAvatar ──────────────────────────────────────────────────────────

  describe('deleteAvatar', () => {
    it('rejects non-UUID userId', async () => {
      await expect(userRepository.deleteAvatar('bad')).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
    })

    it('sets avatar to NULL and returns updated row', async () => {
      const userId = crypto.randomUUID()
      const row = makeUserRow({ id: userId, avatar: null })
      pool.query.mockResolvedValue({ rows: [row] })
      const result = await userRepository.deleteAvatar(userId)
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('avatar = NULL'), [userId])
      expect(result).toEqual(row)
    })

    it('returns null when profile not found', async () => {
      pool.query.mockResolvedValue({ rows: [] })
      const result = await userRepository.deleteAvatar(crypto.randomUUID())
      expect(result).toBeNull()
    })
  })
})
