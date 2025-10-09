const { User, RefreshToken } = require('../models')
const { AuthError, ValidationError } = require('../utils/errors')
const generateTokens = require('../utils/generateTokens')
const validateCredentials = require('../utils/validateCredentials')
const ApiResponse = require('../utils/response')
const {
  jwt: { access, refresh },
} = require('../config/env')

exports.signup = async (req, res, next) => {
  const { username, password, email, avatar, bio } = req.body
  try {
    const user = await User.create({ username, password, email, avatar, bio })
    res
      .status(201)
      .json(
        new ApiResponse(
          'user created successfully',
          { email, username, avatar },
          201
        )
      )
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyValue.hasOwnProperty('email'))
        throw new ValidationError('email already exists', undefined, 409)
      if (err.keyValue.hasOwnProperty('username'))
        throw new ValidationError('username already taken', undefined, 409)
    }
    throw new ValidationError('failed registration', undefined, 500)
  }
}
exports.login = async (req, res, next) => {
  const { email, username, password } = req.body
  const {
    _id: id,
    avatar,
    role,
  } = await validateCredentials({ username, email, password })
  const [accessToken, refreshToken] = generateTokens(
    { id, username, role },
    access,
    refresh
  )
  await RefreshToken.create({ user: id, refreshToken })
  res.status(200).json(
    new ApiResponse('user logged in successfully', {
      user: { id, username, email, avatar },
      accessToken,
      refreshToken,
    })
  )
}
exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body
  const { id } = req.user
  const token = await RefreshToken.findOne({ user: id, refreshToken })
  if (!token) throw new AuthError('invalid token')
  await RefreshToken.deleteOne({ user: id, refreshToken })
  res.status(200).json(new ApiResponse('user logged out successfully'))
}
exports.refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body
  const { id, username, role } = req.user
  const token = await RefreshToken.findOne({ refreshToken, user: id })
  if (!token) throw new AuthError('invalid token')
  await token.deleteOne()
  const [newAccessToken, newRefreshToken] = generateTokens(
    { id, username, role },
    access,
    refresh
  )
  await RefreshToken.create({ user: id, refreshToken: newRefreshToken })
  res.status(200).json(
    new ApiResponse('token generated successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  )
}
