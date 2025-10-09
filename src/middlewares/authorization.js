const { AuthorizationError } = require('../utils/errors')
const { Chat } = require('../models')
exports.role = role => async (req, res, next) => {
  if (req.user.role !== role)
    throw new AuthorizationError('you are not allowed to do this')
  next()
}
exports.chat = async (req, res, next) => {
  const chat = await Chat.findOne(
    {
      _id: req.params.chatId,
      participants: req.user.id,
    },
    { _id: 1 }
  )
  if (!chat) throw new AuthorizationError("you are not allowed to do this as you don't belong to this chat or the chat does not exists")
  next()
}
