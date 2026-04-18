const { StatusCodes } = require('http-status-codes')

const expectError = (response, statusCode, errorCode = null) => {
  expect(response.status).toBe(statusCode)
  expect(response.body.success).toBe(false)
  expect(response.body.error).toBeDefined()
  expect(response.body.error.message).toBeDefined()
  expect(response.body.timestamp).toBeDefined()

  if (errorCode) {
    expect(response.body.error.code).toBe(errorCode)
  }
}

const expectSuccess = (response, status = StatusCodes.OK, message = null) => {
  expect(response.status).toBe(status)
  expect(response.body.success).toBe(true)
  expect(response.body.timestamp).toBeDefined()

  if (message) {
    expect(response.body.message).toBe(message)
  }
}

const expectPagination = (response) => {
  expect(response.body.pagination).toBeDefined()
  expect(response.body.pagination.page).toBeDefined()
  expect(response.body.pagination.limit).toBeDefined()
  expect(response.body.pagination.total).toBeDefined()
  expect(response.body.pagination.totalPages).toBeDefined()
  expect(response.body.pagination.hasNextPage).toBeDefined()
  expect(response.body.pagination.hasPrevPage).toBeDefined()
}

module.exports = { expectError, expectSuccess, expectPagination }
