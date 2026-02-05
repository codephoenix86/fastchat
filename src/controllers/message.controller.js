const { messageService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { StatusCodes } = require('http-status-codes')
const { socketServer, SOCKET_EVENTS } = require('@sockets')

exports.sendMessage = async (req, res) => {
  const { content } = req.body
  const { chatId } = req.params

  const message = await messageService.sendMessage({ content, chatId }, req.user.id)

  // Emit real-time message to chat room
  const io = socketServer.get()
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

exports.getMessage = async (req, res) => {
  const message = await messageService.getMessageById(req.params.messageId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Message fetched successfully', { message }))
}

exports.updateMessage = async (req, res) => {
  const { content } = req.body
  const { chatId } = req.params

  const message = await messageService.updateMessage(req.params.messageId, req.user.id, content)

  // Emit real-time update
  const io = socketServer.get()
  io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_UPDATED, message)

  res.status(StatusCodes.OK).json(new ApiResponse('Message updated successfully', { message }))
}

exports.deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.params

  await messageService.deleteMessage(messageId, req.user.id)

  // Emit real-time deletion
  const io = socketServer.get()
  io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId })

  res.status(StatusCodes.OK).json(new ApiResponse('Message deleted successfully'))
}
