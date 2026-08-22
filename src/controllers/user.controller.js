const { userService, presenceService } = require('@services')
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
  const { page, limit, skip } = pagination.parsePaginationParams(req.query)

  const { users, hasNextPage } = await userService.findAll({ skip, limit })
  const statuses = await presenceService.areUsersOnline(users.map((user) => user.id))

  res.status(StatusCodes.OK).json(
    new ApiResponse('Users fetched successfully', {
      data: users.map((user, i) => ({ ...user, isOnline: statuses[i] === 1 })),
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPrevPage: page > 1,
        total: users.length,
      },
    })
  )
}

exports.getUserById = async (req, res) => {
  const user = await userService.findById(req.params.userId)

  res.status(StatusCodes.OK).json(new ApiResponse('User fetched successfully', { user }))
}

exports.getCurrentUser = async (req, res) => {
  const user = await userService.findById(req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Current user details', { user }))
}

exports.updateCurrentUser = async (req, res) => {
  const { username, bio } = req.body

  const user = await userService.updateById(req.user.id, { username, bio })

  res.status(StatusCodes.OK).json(new ApiResponse('User updated successfully', { user }))
}

exports.deleteCurrentUser = async (req, res) => {
  const user = await userService.deleteById(req.user.id)
  res.status(StatusCodes.OK).json(new ApiResponse('Account deleted successfully', { user }))
}

exports.uploadAvatar = async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    throw new ValidationError('Please upload an image file')
  }

  const user = await userService.updateAvatar(req.user.id, req.file)

  res.status(StatusCodes.OK).json(new ApiResponse('Avatar uploaded successfully', { user }))
}

exports.deleteAvatar = async (req, res) => {
  const user = await userService.deleteAvatar(req.user.id)

  res.status(StatusCodes.OK).json(new ApiResponse('Avatar removed successfully', { user }))
}

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body

  await userService.changePassword(req.user.id, currentPassword, newPassword)

  res.status(StatusCodes.OK).json(new ApiResponse('Password changed successfully'))
}
