const { chatService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { StatusCodes } = require('http-status-codes')
const { CHAT_TYPES } = require('@constants')

exports.createChat = async (req, res) => {
  const { participants, type, groupName } = req.body

  let chat
  if (type === CHAT_TYPES.GROUP) {
    chat = await chatService.createGroupChat({ participants, groupName }, req.user.id)
  }
  if (type === CHAT_TYPES.PRIVATE) {
    chat = await chatService.createPrivateChat(req.user.id, participants[0])
  }
  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Chat created successfully', { chat }, StatusCodes.CREATED))
}

exports.getChats = async (req, res) => {
  const { page, limit, skip } = pagination.parsePaginationParams(req.query)

  const { chats, hasNextPage } = await chatService.getUserChats(req.user.id, { skip, limit })

  res.status(StatusCodes.OK).json(
    new ApiResponse('Chats fetched successfully', {
      data: chats,
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPrevPage: page > 1,
        total: chats.length,
      },
    })
  )
}

exports.getChatById = async (req, res) => {
  const chat = await chatService.getChatById(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Chat fetched successfully', { chat }))
}

exports.updateGroup = async (req, res) => {
  const { groupName, groupPicture, admin } = req.body

  const chat = await chatService.updateGroup(req.params.chatId, req.user.id, {
    groupName,
    groupPicture,
    admin,
  })

  res.status(StatusCodes.OK).json(new ApiResponse('Chat updated successfully', { chat }))
}

exports.deleteGroup = async (req, res) => {
  await chatService.deleteGroup(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Chat deleted successfully'))
}

exports.addMember = async (req, res) => {
  const updatedChat = await chatService.addMember(req.params.chatId, req.user.id, req.params.userId)

  res.status(StatusCodes.OK).json(new ApiResponse('Member added successfully', updatedChat))
}

exports.removeSelf = async (req, res) => {
  const updatedChat = await chatService.removeMember(req.params.chatId, req.user.id, req.user.id)
  res.status(StatusCodes.OK).json(new ApiResponse('Member removed successfully', updatedChat))
}

exports.removeMember = async (req, res) => {
  const updatedChat = await chatService.removeMember(
    req.params.chatId,
    req.user.id,
    req.params.userId
  )

  res.status(StatusCodes.OK).json(new ApiResponse('Member removed successfully', updatedChat))
}

exports.getMembers = async (req, res) => {
  const members = await chatService.getMembers(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Members fetched successfully', members))
}

exports.markAsRead = async (req, res) => {
  const { sequence } = req.query
  const { chatId } = req.params
  const updatedChat = await chatService.markAsRead(chatId, req.user.id, sequence)
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse('User marked as read successfully', { chat: updatedChat }))
}
