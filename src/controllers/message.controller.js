const { StatusCodes } = require('http-status-codes')
const { messageService, presenceService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { SOCKET_EVENTS } = require('@constants')
const { io } = require('@sockets')

exports.sendMessage = async (req, res) => {
  const { content } = req.body
  const { chatId } = req.params

  const { chat, message } = await messageService.sendMessage({
    content,
    chatId,
    senderId: req.user.id,
  })

  // Emit real-time message to chat room
  io.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
    message: message,
    chat: message.chat,
    content: message.content,
    createdAt: message.createdAt,
  })

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Message sent successfully', { chat, message }, StatusCodes.CREATED))
}

exports.getMessages = async (req, res) => {
  const { chatId } = req.params
  const { page, limit } = pagination.parsePaginationParams(req.query)
  const cursor = req.query.cursor

  const { messages, hasNextPage, nextCursor } = await messageService.getChatMessages(
    chatId,
    req.user.id,
    {
      cursor,
      limit,
    }
  )

  res.status(StatusCodes.OK).json(
    new ApiResponse('Messages fetched successfully', {
      data: messages,
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPrevPage: page > 1,
        total: messages.length,
        nextCursor,
      },
    })
  )
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

  // Emit real-time message to chat room
  io.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
    message: message,
    chat: message.chat,
    content: message.content,
    createdAt: message.createdAt,
  })

  res.status(StatusCodes.OK).json(new ApiResponse('Message updated successfully', { message }))
}

exports.sendDirectMessage = async (req, res) => {
  const { peerId, content } = req.body

  const { chat, message } = await messageService.sendDirectMessage(
    { senderId: req.user.id, peerId },
    { content }
  )

  const user1SocketIds = await presenceService.getUserSockets(req.user.id)
  const user2SocketIds = await presenceService.getUserSockets(peerId)
  io.in([...user1SocketIds, ...user2SocketIds]).socketsJoin(`chat:${chat.id}`)

  io.to(`chat:${chat.id}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
    message,
    chat,
    content: message.content,
    createdAt: message.createdAt,
  })

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Message sent successfully', { chat, message }, StatusCodes.CREATED))
}
