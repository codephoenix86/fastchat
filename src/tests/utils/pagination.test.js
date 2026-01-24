const {
  parsePaginationParams,
  parseFilterParams,
  createPaginatedResponse,
} = require('../../utils/helpers/pagination')

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should return default pagination params when query is empty', () => {
      const result = parsePaginationParams({})

      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.skip).toBe(0)
      expect(result.sort).toEqual({ createdAt: -1 })
    })

    it('should parse page and limit from query', () => {
      const query = { page: '2', limit: '50' }
      const result = parsePaginationParams(query)

      expect(result.page).toBe(2)
      expect(result.limit).toBe(50)
      expect(result.skip).toBe(50)
    })

    it('should enforce minimum page of 1', () => {
      const query = { page: '0' }
      const result = parsePaginationParams(query)

      expect(result.page).toBe(1)
    })

    it('should enforce maximum limit of 100', () => {
      const query = { limit: '200' }
      const result = parsePaginationParams(query)

      expect(result.limit).toBe(100)
    })

    it('should enforce minimum limit of 1', () => {
      // When limit is 0, it returns default (20) because 0 is falsy
      const query1 = { limit: '0' }
      const result1 = parsePaginationParams(query1)
      expect(result1.limit).toBe(20)

      // When limit is negative, Math.max enforces minimum of 1
      const query2 = { limit: '-5' }
      const result2 = parsePaginationParams(query2)
      expect(result2.limit).toBe(1)
    })

    it('should calculate skip correctly', () => {
      const query = { page: '3', limit: '10' }
      const result = parsePaginationParams(query)

      expect(result.skip).toBe(20)
    })

    it('should parse sort ascending', () => {
      const query = { sort: 'username' }
      const result = parsePaginationParams(query)

      expect(result.sort).toEqual({ username: 1 })
    })

    it('should parse sort descending', () => {
      const query = { sort: '-createdAt' }
      const result = parsePaginationParams(query)

      expect(result.sort).toEqual({ createdAt: -1 })
    })

    it('should parse multiple sort fields', () => {
      const query = { sort: '-createdAt,username' }
      const result = parsePaginationParams(query)

      expect(result.sort).toEqual({ createdAt: -1, username: 1 })
    })

    it('should handle invalid page gracefully', () => {
      const query = { page: 'invalid' }
      const result = parsePaginationParams(query)

      expect(result.page).toBe(1)
    })

    it('should handle invalid limit gracefully', () => {
      const query = { limit: 'invalid' }
      const result = parsePaginationParams(query)

      expect(result.limit).toBe(20)
    })
  })

  describe('parseFilterParams', () => {
    it('should return empty filter when no allowed filters', () => {
      const query = { role: 'admin', status: 'active' }
      const result = parseFilterParams(query, [])

      expect(result).toEqual({})
    })

    it('should only include allowed filters', () => {
      const query = { role: 'admin', status: 'active', other: 'value' }
      const result = parseFilterParams(query, ['role', 'status'])

      expect(result).toEqual({ role: 'admin', status: 'active' })
    })

    it('should include search query', () => {
      const query = { search: 'test' }
      const result = parseFilterParams(query, [])

      expect(result).toEqual({ search: 'test' })
    })

    it('should handle missing filter fields', () => {
      const query = { role: 'admin' }
      const result = parseFilterParams(query, ['role', 'status'])

      expect(result).toEqual({ role: 'admin' })
    })
  })

  describe('createPaginatedResponse', () => {
    it('should create paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const result = createPaginatedResponse(data, 100, 1, 20)

      expect(result.data).toEqual(data)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(result.pagination.total).toBe(100)
      expect(result.pagination.totalPages).toBe(5)
      expect(result.pagination.hasNextPage).toBe(true)
      expect(result.pagination.hasPrevPage).toBe(false)
    })

    it('should calculate totalPages correctly', () => {
      const data = []
      const result = createPaginatedResponse(data, 25, 1, 10)

      expect(result.pagination.totalPages).toBe(3)
    })

    it('should set hasNextPage to false on last page', () => {
      const data = []
      const result = createPaginatedResponse(data, 100, 5, 20)

      expect(result.pagination.hasNextPage).toBe(false)
    })

    it('should set hasPrevPage to true when not on first page', () => {
      const data = []
      const result = createPaginatedResponse(data, 100, 3, 20)

      expect(result.pagination.hasPrevPage).toBe(true)
    })

    it('should handle empty data', () => {
      const result = createPaginatedResponse([], 0, 1, 20)

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should handle single page of data', () => {
      const data = [{ id: 1 }]
      const result = createPaginatedResponse(data, 1, 1, 20)

      expect(result.pagination.totalPages).toBe(1)
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.hasPrevPage).toBe(false)
    })
  })
})