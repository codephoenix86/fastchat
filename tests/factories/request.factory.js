const crypto = require('crypto')

const buildRefreshToken = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  user: crypto.randomUUID(),
  refreshToken: 'mock_refresh_token',
  createdAt: new Date(),
  ...overrides,
})

const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  id: 'test-request-id',
  ...overrides,
})

const mockResponse = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

const mockNext = () => jest.fn()

module.exports = { buildRefreshToken, mockRequest, mockResponse, mockNext }
