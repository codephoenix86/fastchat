const { User } = require('../models')
const { AuthError } = require('../utils/errors')
exports.signup = async (req, res, next) => {
  const { username, password } = req.body
  const data = await User.create({ username, password })
  res
    .status(200)
    .json({ success: true, message: 'user created successfully', data })
}
exports.login = async (req, res, next) => {
  const { username, password } = req.body
  const data = await User.findOne({ username, password })
  if (!data) throw new AuthError()
  res
    .status(200)
    .json({
      success: true,
      message: 'user logged in successfully',
      data,
      timestamp: new Date().toISOString(),
    })
}
