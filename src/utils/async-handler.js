/**
 * Wrapper for async route handlers
 * Catches errors and passes them to error handling middleware
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
module.exports = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next)
  } catch (err) {
    next(err)
  }
}
