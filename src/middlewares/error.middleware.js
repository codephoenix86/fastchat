const { logger, env } = require('@config')
const { StatusCodes } = require('http-status-codes')

/**
 * Global error handling middleware
 */
module.exports = (err, req, res, _next) => {
  // Log error with context
  logger.error(err.name, {
    name: err.name,
    code: err.code,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    requestId: req.id,
  })

  // Operational errors (expected errors we throw)
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message,
        ...(err.errors && { details: err.errors }),
      },
      timestamp: err.timestamp || new Date().toISOString(),
      requestId: req.id,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    })
  } else {
    // Programming or unknown errors (don't leak error details in production)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      },
      timestamp: new Date().toISOString(),
      requestId: req.id,
      ...(env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    })
  }
}
