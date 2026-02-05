const message = (text, code = 'VALIDATION_ERROR', expected = 'unknown') => ({
  text,
  code,
  expected,
})
module.exports = message
