const { ApiResponse } = require('@utils')

describe('ApiResponse', () => {
  it('sets success, message, data, and timestamp', () => {
    const response = new ApiResponse('Success', { user: 'test' })

    expect(response.success).toBe(true)
    expect(response.message).toBe('Success')
    expect(response.data).toEqual({ user: 'test' })
    expect(response.timestamp).toBeDefined()
  })

  it('sets data to null when omitted', () => {
    expect(new ApiResponse('Success').data).toBeNull()
  })

  it('spreads pagination from a paginated data object', () => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      pagination: { page: 1, limit: 20, total: 100, totalPages: 5 },
    }

    const response = new ApiResponse('Success', paginatedData)

    expect(response.data).toEqual(paginatedData.data)
    expect(response.pagination).toEqual(paginatedData.pagination)
  })

  it('sets timestamp as an ISO string', () => {
    const response = new ApiResponse('Success')

    expect(typeof response.timestamp).toBe('string')
    expect(new Date(response.timestamp)).toBeInstanceOf(Date)
  })

  it('always sets success to true', () => {
    expect(new ApiResponse('Message', null, 404).success).toBe(true)
  })

  it('handles empty object data', () => {
    expect(new ApiResponse('Success', {}).data).toEqual({})
  })

  it('handles array data', () => {
    const data = [1, 2, 3]
    expect(new ApiResponse('Success', data).data).toEqual(data)
  })

  it('does not add pagination for non-paginated objects', () => {
    const data = { user: { id: 1 }, token: 'abc123' }
    const response = new ApiResponse('Success', data)

    expect(response.data).toEqual(data)
    expect(response.pagination).toBeUndefined()
  })
})
