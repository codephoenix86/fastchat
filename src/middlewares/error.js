module.exports = (err, req, res, next) => {
  const { message, errors, timestamp } = err
  const status = err.status || 500
  if (err.operational)
    res
      .status(status)
      .json({ success: false, message, status, errors, timestamp })
  else
    res
      .status(500)
      .json({
        success: false,
        message: 'Internal Server Error',
        status: 500,
        timestamp,
      })
}
