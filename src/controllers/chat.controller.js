const { chatService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { StatusCodes } = require('http-status-codes')

exports.createChat = async (req, res) => {
  const { participants, type, groupName } = req.body

  const chat = await chatService.createChat({ participants, type, groupName }, req.user.id)

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse('Chat created successfully', { chat }, StatusCodes.CREATED))
}

exports.getChats = async (req, res) => {
  const { page, limit, skip, sort } = pagination.parsePaginationParams(req.query)

  // Build filter
  const filter = {}
  if (req.query.type) {
    filter.type = req.query.type
  }

  const { chats, total } = await chatService.getUserChats(req.user.id, {
    filter,
    skip,
    limit,
    sort,
  })

  const paginatedData = pagination.createPaginatedResponse(chats, total, page, limit)

  res.status(StatusCodes.OK).json(new ApiResponse('Chats fetched successfully', paginatedData))
}

exports.getChat = async (req, res) => {
  const chat = await chatService.getChatById(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Chat fetched successfully', { chat }))
}

exports.updateChat = async (req, res) => {
  const { groupName, groupPicture, admin } = req.body

  const chat = await chatService.updateChat(req.params.chatId, req.user.id, {
    groupName,
    groupPicture,
    admin,
  })

  res.status(StatusCodes.OK).json(new ApiResponse('Chat updated successfully', { chat }))
}

exports.deleteChat = async (req, res) => {
  await chatService.deleteChat(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Chat deleted successfully'))
}

exports.addMember = async (req, res) => {
  const { userId } = req.body

  await chatService.addMember(req.params.chatId, req.user.id, userId)

  res.status(StatusCodes.OK).json(new ApiResponse('Member added successfully'))
}

exports.removeMember = async (req, res) => {
  const memberIdToRemove = req.params.userId === 'me' ? req.user.id : req.params.userId

  await chatService.removeMember(req.params.chatId, req.user.id, memberIdToRemove)

  res.status(StatusCodes.OK).json(new ApiResponse('Member removed successfully'))
}

exports.getMembers = async (req, res) => {
  const members = await chatService.getMembers(req.params.chatId, req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Members fetched successfully', { members }))
}
