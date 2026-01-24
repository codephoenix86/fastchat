const ApiResponse = require('../../utils/response/response')

describe('ApiResponse', () => {
  it('should create response with message and data', () => {
    const response = new ApiResponse('Success', { user: 'test' })

    expect(response.success).toBe(true)
    expect(response.message).toBe('Success')
    expect(response.data).toEqual({ user: 'test' })
    expect(response.timestamp).toBeDefined()
  })

  it('should create response with null data', () => {
    const response = new ApiResponse('Success')

    expect(response.data).toBeNull()
  })

  it('should handle paginated data', () => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      },
    }

    const response = new ApiResponse('Success', paginatedData)

    expect(response.data).toEqual(paginatedData.data)
    expect(response.pagination).toEqual(paginatedData.pagination)
  })

  it('should set timestamp as ISO string', () => {
    const response = new ApiResponse('Success')

    expect(typeof response.timestamp).toBe('string')
    expect(new Date(response.timestamp)).toBeInstanceOf(Date)
  })

  it('should always set success to true', () => {
    const response = new ApiResponse('Message', null, 404)

    expect(response.success).toBe(true)
  })

  it('should handle empty objects', () => {
    const response = new ApiResponse('Success', {})

    expect(response.data).toEqual({})
  })

  it('should handle arrays', () => {
    const data = [1, 2, 3]
    const response = new ApiResponse('Success', data)

    expect(response.data).toEqual(data)
  })

  it('should not spread non-paginated objects to root', () => {
    const data = {
      user: { id: 1 },
      token: 'abc123',
    }

    const response = new ApiResponse('Success', data)

    expect(response.data).toEqual(data)
    expect(response.pagination).toBeUndefined()
  })
})