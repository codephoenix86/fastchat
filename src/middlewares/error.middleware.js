const { logger, env } = require('@config')
const { StatusCodes } = require('http-status-codes')

module.exports = (err, req, res, _next) => {
  // Operational errors are expected domain errors — log at warn so they don't
  // trigger on-call alerts. Unknown/programming errors are true failures — log at error.
  const level = err.isOperational ? 'warn' : 'error'

  logger[level]('Unhandled error', {
    err,
    requestId: req.id,
    userId: req.user?.id,
    method: req.method,
    url: req.originalUrl,
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
