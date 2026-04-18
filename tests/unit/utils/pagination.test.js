const {
  pagination: { parseFilterParams, createPaginatedResponse, parsePaginationParams },
} = require('@utils')

describe('parsePaginationParams', () => {
  it('returns defaults when query is empty', () => {
    const result = parsePaginationParams({})

    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.skip).toBe(0)
    expect(result.sort).toEqual([['created_at', -1]])
  })

  it('parses page and limit from query', () => {
    const result = parsePaginationParams({ page: '2', limit: '50' })

    expect(result.page).toBe(2)
    expect(result.limit).toBe(50)
    expect(result.skip).toBe(50)
  })

  it('enforces minimum page of 1', () => {
    expect(parsePaginationParams({ page: '0' }).page).toBe(1)
  })

  it('enforces maximum limit of 100', () => {
    expect(parsePaginationParams({ limit: '200' }).limit).toBe(100)
  })

  it('enforces minimum limit of 1 for negative values', () => {
    expect(parsePaginationParams({ limit: '-5' }).limit).toBe(1)
  })

  it('falls back to default limit when limit is 0', () => {
    expect(parsePaginationParams({ limit: '0' }).limit).toBe(20)
  })

  it('calculates skip correctly', () => {
    expect(parsePaginationParams({ page: '3', limit: '10' }).skip).toBe(20)
  })

  it('parses ascending sort', () => {
    expect(parsePaginationParams({ sort: 'username' }).sort).toEqual([['username', 1]])
  })

  it('parses descending sort', () => {
    expect(parsePaginationParams({ sort: '-created_at' }).sort).toEqual([['created_at', -1]])
  })

  it('parses multiple sort fields', () => {
    expect(parsePaginationParams({ sort: '-created_at,username' }).sort).toEqual([
      ['created_at', -1],
      ['username', 1],
    ])
  })

  it('falls back to defaults for invalid page or limit', () => {
    expect(parsePaginationParams({ page: 'invalid' }).page).toBe(1)
    expect(parsePaginationParams({ limit: 'invalid' }).limit).toBe(20)
  })
})

describe('parseFilterParams', () => {
  it('returns empty object when no allowed filters are specified', () => {
    expect(parseFilterParams({ role: 'admin', status: 'active' }, [])).toEqual({})
  })

  it('returns only allowed filter keys', () => {
    const result = parseFilterParams({ role: 'admin', status: 'active', other: 'value' }, [
      'role',
      'status',
    ])
    expect(result).toEqual({ role: 'admin', status: 'active' })
  })

  it('includes search regardless of allowed filters', () => {
    expect(parseFilterParams({ search: 'test' }, [])).toEqual({ search: 'test' })
  })

  it('omits missing filter fields', () => {
    expect(parseFilterParams({ role: 'admin' }, ['role', 'status'])).toEqual({ role: 'admin' })
  })
})

describe('createPaginatedResponse', () => {
  it('returns correct pagination shape', () => {
    const result = createPaginatedResponse([{ id: 1 }, { id: 2 }], 100, 1, 20)

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
    expect(result.pagination.total).toBe(100)
    expect(result.pagination.totalPages).toBe(5)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(false)
  })

  it('calculates totalPages correctly', () => {
    expect(createPaginatedResponse([], 25, 1, 10).pagination.totalPages).toBe(3)
  })

  it('sets hasNextPage to false on the last page', () => {
    expect(createPaginatedResponse([], 100, 5, 20).pagination.hasNextPage).toBe(false)
  })

  it('sets hasPrevPage to true when not on the first page', () => {
    expect(createPaginatedResponse([], 100, 3, 20).pagination.hasPrevPage).toBe(true)
  })

  it('handles empty data', () => {
    const result = createPaginatedResponse([], 0, 1, 20)

    expect(result.data).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.totalPages).toBe(0)
  })

  it('handles a single page of data', () => {
    const result = createPaginatedResponse([{ id: 1 }], 1, 1, 20)

    expect(result.pagination.totalPages).toBe(1)
    expect(result.pagination.hasNextPage).toBe(false)
    expect(result.pagination.hasPrevPage).toBe(false)
  })
})
