const xss = require('xss')

/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return xss(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item))
  }

  if (value !== null && typeof value === 'object') {
    const sanitized = {}
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue
      }
      sanitized[key] = sanitizeValue(val)
    }
    return sanitized
  }

  return value
}

/**
 * Sanitize request body middleware
 */
module.exports = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body)
  }
  next()
}
