const { userService } = require('@services')
const { ApiResponse, pagination } = require('@utils')
const { StatusCodes } = require('http-status-codes')
const { ValidationError } = require('@errors')

/**
 * Get all users with pagination, filtering, and search
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search in username or email
 * - role: Filter by role
 * - sort: Sort fields (e.g., -createdAt,username)
 */
exports.getUsers = async (req, res) => {
  const { page, limit, skip, sort } = pagination.parsePaginationParams(req.query)

  // Build filter
  const filter = {}
  if (req.query.role) {
    filter.role = req.query.role
  }

  const { users, total } = await userService.findAllUsers({
    filter,
    skip,
    limit,
    sort,
    search: req.query.search,
  })

  const paginatedData = pagination.createPaginatedResponse(users, total, page, limit)

  res.status(StatusCodes.OK).json(new ApiResponse('Users fetched successfully', paginatedData))
}

exports.getUserById = async (req, res) => {
  const user = await userService.findUserById(req.params.id)

  res.status(StatusCodes.OK).json(new ApiResponse('User fetched successfully', { user }))
}

exports.getCurrentUser = async (req, res) => {
  const user = await userService.findUserById(req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Current user details', { user }))
}

exports.updateCurrentUser = async (req, res) => {
  const { newEmail, newUsername, newPassword, newBio, oldPassword } = req.body

  const updateData = {}
  if (newEmail) {
    updateData.email = newEmail
  }
  if (newUsername) {
    updateData.username = newUsername
  }
  if (newPassword) {
    updateData.password = newPassword
  }
  if (newBio !== undefined) {
    updateData.bio = newBio
  }

  const user = await userService.updateUser(req.user.id, updateData, oldPassword)

  res.status(StatusCodes.OK).json(new ApiResponse('User updated successfully', { user }))
}

exports.deleteCurrentUser = async (req, res) => {
  await userService.deleteUser(req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Account deleted successfully'))
}

exports.uploadAvatar = async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    throw new ValidationError('Please upload an image file')
  }

  const user = await userService.updateAvatar(req.user.id, req.file.filename)

  res.status(StatusCodes.OK).json(new ApiResponse('Avatar uploaded successfully', { user }))
}

exports.deleteAvatar = async (req, res) => {
  const user = await userService.updateAvatar(req.user.id, null)

  res.status(StatusCodes.OK).json(new ApiResponse('Avatar removed successfully', { user }))
}

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body

  await userService.changePassword(req.user.id, oldPassword, newPassword)

  res.status(StatusCodes.OK).json(new ApiResponse('Password changed successfully'))
}
