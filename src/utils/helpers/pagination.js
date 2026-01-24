/**
 * Parse pagination parameters from request query
 * @param {Object} query - Request query object
 * @returns {Object} - { page, limit, skip, sort }
 */
exports.parsePaginationParams = query => {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
  const skip = (page - 1) * limit

  // Parse sort: ?sort=-createdAt,username
  let sort = {}
  if (query.sort) {
    query.sort.split(',').forEach(field => {
      if (field.startsWith('-')) {
        sort[field.substring(1)] = -1
      } else {
        sort[field] = 1
      }
    })
  } else {
    // Default sort by creation date (newest first)
    sort = { createdAt: -1 }
  }

  return { page, limit, skip, sort }
}

/**
 * Parse filter parameters from request query
 * @param {Object} query - Request query object
 * @param {Array} allowedFilters - Allowed filter fields
 * @returns {Object} - MongoDB filter object
 */
exports.parseFilterParams = (query, allowedFilters = []) => {
  const filter = {}

  allowedFilters.forEach(field => {
    if (query[field]) {
      filter[field] = query[field]
    }
  })

  // Search query (if provided)
  if (query.search) {
    filter.search = query.search
  }

  return filter
}

/**
 * Create paginated response
 * @param {Array} data - Data array
 * @param {Number} total - Total count
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @returns {Object} - Standardized paginated response
 */
exports.createPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit)

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}