const { StatusCodes } = require('http-status-codes')
const { messageService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { SOCKET_EVENTS } = require('@constants')
const { io } = require('@sockets')

exports.sendMessage = async (req, res) => {
  const { content } = req.body
  const { chatId } = req.params

  const message = await messageService.sendMessage({ content, chatId, senderId: req.user.id })

  // Emit real-time message to chat room
  io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_NEW, message)

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Message sent successfully', { message }, StatusCodes.CREATED))
}

exports.getMessages = async (req, res) => {
  const { chatId } = req.params
  const { page, limit, skip, sort } = pagination.parsePaginationParams(req.query)

  const { messages, total } = await messageService.getChatMessages(chatId, req.user.id, {
    skip,
    limit,
    sort,
  })

  const paginatedData = pagination.createPaginatedResponse(messages, total, page, limit)

  res.status(StatusCodes.OK).json(new ApiResponse('Messages fetched successfully', paginatedData))
}

exports.getMessageById = async (req, res) => {
  const { messageId } = req.params
  const message = await messageService.getMessageById(messageId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Message fetched successfully', { message }))
}

exports.updateMessage = async (req, res) => {
  const { content } = req.body
  const { chatId } = req.params

  const message = await messageService.updateMessage(req.params.messageId, req.user.id, content)

  // Emit real-time update
  io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_UPDATED, message)

  res.status(StatusCodes.OK).json(new ApiResponse('Message updated successfully', { message }))
}

exports.sendDirectMessage = async (req, res) => {
  const { peerId, content } = req.body

  const { chat, message } = await messageService.sendDirectMessage(
    { senderId: req.user.id, peerId },
    { content }
  )

  io.to(chat.id).emit(SOCKET_EVENTS.MESSAGE_NEW, message)

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Message sent successfully', { chat, message }, StatusCodes.CREATED))
}
