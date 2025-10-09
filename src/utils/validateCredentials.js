const { User } = require('../models')
const { AuthError } = require('../utils/errors')
const bcrypt = require('bcrypt')
const validateCredentials = async ({ email, username, password }) => {
  const query = {}
  if (username) query.username = username
  if (email) query.email = email
  console.log(query)
  const user = await User.findOne(query).select('+password')
  if (!user) throw new AuthError('invalid credentials')
  const match = await bcrypt.compare(password, user.password)
  if (!match) throw new AuthError('invalid credentials')
  return user
}
module.exports = validateCredentials
