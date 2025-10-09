const { Chat, User } = require('../models')
const mongoose = require('mongoose')
const ApiResponse = require('../utils/response')
const { NotFoundError, ValidationError } = require('../utils/errors')
exports.createChat = async (req, res, next) => {
  const { participants } = req.body
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const count = await User.countDocuments({
      _id: { $in: participants },
    }).session(session)
    if (count !== participants.length)
      throw new ValidationError(
        'there is at least one user that does not exists'
      )
    const [chat] = await Chat.create(
      [
        {
          admin: req.user.id,
          participants: [req.user.id, ...participants],
        },
      ],
      { session }
    )
    await session.commitTransaction()
    res.status(201).json(new ApiResponse('chat created successfully', { chat }))
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}
exports.getChats = async (req, res, next) => {
  const chats = await Chat.find({ participants: req.user.id }).populate(
    'participants',
    'username avatar -_id'
  )
  if (chats.length == 0) throw new NotFoundError('no chats found')
  res.status(200).json(new ApiResponse('chats fetched successfully', { chats }))
}
