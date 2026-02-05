/**
 * Standard API response format
 * Handles both regular and paginated responses
 */
class ApiResponse {
  constructor(message, data = null) {
    this.success = true
    this.message = message
    this.timestamp = new Date().toISOString()

    // If data contains pagination metadata, spread it to root level
    // Otherwise, nest everything under 'data' key
    if (data && typeof data === 'object' && data.pagination) {
      this.data = data.data
      this.pagination = data.pagination
    } else {
      this.data = data
    }
  }
}

module.exports = ApiResponse
