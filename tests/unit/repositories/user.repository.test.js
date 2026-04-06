const crypto = require('crypto')
const { ConflictError } = require('@errors')

jest.mock('@config', () => {
  const mockPool = { query: jest.fn(), connect: jest.fn() }
  return {
    postgres: {
      getPool: () => mockPool,
    },
  }
})

const userRepository = require('@repositories/user.repository')
const { postgres } = require('@config')
const pool = postgres.getPool()

describe('UserRepository', () => {
  beforeEach(() => {
    pool.query.mockReset()
    pool.connect.mockReset()
  })

  describe('findById', () => {
    it('rejects bad ids', async () => {
      await expect(userRepository.findById('nope')).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  describe('contains', () => {
    it('short-circuits empty lists', async () => {
      await expect(userRepository.contains([])).resolves.toBe(true)
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('uses bound params for IN (...)', async () => {
      const a = crypto.randomUUID()
      const b = crypto.randomUUID()
      pool.query.mockResolvedValue({ rows: [{ count: '2' }] })

      await userRepository.contains([a, b])

      expect(pool.query).toHaveBeenCalledTimes(1)
      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).toMatch(/IN \(\$1, \$2\)/)
      expect(params).toEqual([a, b])
    })

    it('rejects junk ids in the array', async () => {
      await expect(userRepository.contains(['x'])).rejects.toMatchObject({ code: 'INVALID_UUID' })
      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('handles mongo-style sort objects without blowing up', async () => {
      pool.query.mockResolvedValue({ rows: [] })

      await userRepository.findAll(undefined, {}, { sort: { createdAt: -1 } })

      const [sql] = pool.query.mock.calls[0]
      expect(sql).toMatch(/ORDER BY users\.created_at DESC/)
    })

    it('drops random filter keys', async () => {
      pool.query.mockResolvedValue({ rows: [] })

      await userRepository.findAll(undefined, { role: 'admin', dropTable: '1' })

      const [sql, params] = pool.query.mock.calls[0]
      expect(sql).not.toMatch(/dropTable/)
      expect(sql).toMatch(/users\.role/)
      expect(params).toContain('admin')
    })

    it('rejects bad role values even if something slips past the controller', async () => {
      await expect(userRepository.findAll(undefined, { role: 'superadmin' })).rejects.toMatchObject(
        { code: 'INVALID_ROLE' }
      )
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('rejects non-uuid id filters', async () => {
      await expect(userRepository.findAll(undefined, { id: 'not-a-uuid' })).rejects.toMatchObject({
        code: 'INVALID_UUID',
      })
      expect(pool.query).not.toHaveBeenCalled()
    })

    it('clamps weird pagination', async () => {
      pool.query.mockResolvedValue({ rows: [] })

      await userRepository.findAll(undefined, {}, { limit: 9999, skip: -3 })

      const args = pool.query.mock.calls[0][1]
      expect(args[args.length - 2]).toBe(100)
      expect(args[args.length - 1]).toBe(0)
    })
  })

  describe('create', () => {
    it('maps duplicate email to ConflictError', async () => {
      const err = Object.assign(new Error('dup'), {
        code: '23505',
        constraint: 'users_email_key',
      })
      pool.query.mockRejectedValueOnce(err)

      await expect(
        userRepository.create({
          email: 'a@b.com',
          username: 'u',
          password_hash: 'h',
        })
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('updateById', () => {
    const userId = crypto.randomUUID()

    it('rolls back when an update fails', async () => {
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

      pool.connect.mockResolvedValue({
        query: clientQuery,
        release: jest.fn(),
      })

      await expect(userRepository.updateById(userId, { username: 'newname' })).rejects.toThrow(
        'db went sideways'
      )

      expect(clientQuery.mock.calls.map((c) => c[0])).toContain('ROLLBACK')
    })
  })
})
