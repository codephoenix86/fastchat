const { PrismaClient, Prisma } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { postgres } = require('@config')
const { ConflictError } = require('@errors')

const pool = postgres.getPool()
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

class UserRepository {
  async create(userData) {
    const { email, username, password_hash } = userData
    try {
      const user = await prisma.user.create({
        data: {
          email,
          username,
          password_hash,
          profile: {
            create: {},
          },
        },
      })
      return {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 is Prisma's universal code for "Unique constraint failed"
        if (err.code === 'P2002') {
          const target = err.meta?.driverAdapterError?.cause?.originalMessage || ''
          if (target.includes('users_email_key')) {
            throw new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
          }
          if (target.includes('users_username_key')) {
            throw new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
          }
        }
      }
      throw err
    }
  }

  async existAll(userIds) {
    const usersCount = await prisma.user.count({
      where: {
        id: {
          in: userIds,
        },
      },
    })
    const allUsersExists = userIds.length === usersCount
    return allUsersExists
  }

  async findByEmailOrUsername(identifier, isIncludePassword = false) {
    // findFirst returns the first match, or null if nothing is found
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        ...(isIncludePassword && { password_hash: true }),
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    if (!user) {
      return null
    }
    return {
      id: user.id,
      username: user.username || undefined,
      email: user.email || undefined,
      password_hash: user.password_hash || undefined,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile.last_seen || undefined,
    }
  }
  async findById(userId, isIncludePassword = false) {
    // findUnique is highly optimized for searching by primary keys (@id)
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        ...(isIncludePassword && { password_hash: true }),
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    if (!user) {
      return null
    }
    return {
      id: user.id,
      username: user.username || undefined,
      email: user.email || undefined,
      password_hash: user.password_hash || undefined,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile.last_seen || undefined,
    }
  }

  async findAll(options = {}) {
    const users = await prisma.user.findMany({
      skip: options.skip,
      take: options.limit,
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile.last_seen || undefined,
    }))
  }

  async findProfiles(userIds) {
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            avatar: true,
            bio: true,
            last_seen: true,
          },
        },
      },
    })
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile.last_seen || undefined,
    }))
  }

  async updateById(userId, updateData) {
    const { username, password_hash, bio, avatar } = updateData
    const hasUserUpdate = username !== undefined || password_hash !== undefined
    const hasProfileUpdate = bio !== undefined || avatar !== undefined
    let updatedUser
    if (!hasUserUpdate && !hasProfileUpdate) {
      updatedUser = await this.findById(userId)
    }
    const data = {}
    if (hasUserUpdate) {
      if (username !== undefined) {
        data.username = username
      }
      if (password_hash !== undefined) {
        data.password_hash = password_hash
      }
    }
    if (hasProfileUpdate) {
      data.profile = {
        update: {},
      }
      if (bio !== undefined) {
        data.profile.update.bio = bio
      }
      if (avatar !== undefined) {
        data.profile.update.avatar = avatar
      }
    }
    try {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              bio: true,
              avatar: true,
              last_seen: true,
            },
          },
        },
      })
      if (!updatedUser) {
        return null
      }
      return {
        id: updatedUser.id,
        username: updatedUser.username,
        bio: updatedUser.profile.bio || undefined,
        avatar: updatedUser.profile.avatar || undefined,
        lastSeen: updatedUser.last_seen || undefined,
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 is Prisma's universal code for "Unique constraint failed"
        if (err.code === 'P2002') {
          const target = err.meta?.target || []
          const message = err.message || ''
          if (target.includes('email') || message.includes('email')) {
            throw new ConflictError('Email already exists', 'EMAIL_ALREADY_EXISTS')
          }
          if (target.includes('username') || message.includes('username')) {
            throw new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN')
          }
        }
      }
      throw err
    }
  }
  async deleteById(userId) {
    try {
      const deletedUser = await prisma.user.delete({
        where: {
          id: userId,
        },
      })
      if (!deletedUser) {
        return null
      }
      return {
        id: deletedUser.id,
        username: deletedUser.username,
      }
    } catch (err) {
      // P2025 is Prisma's universal error code for "Record to delete does not exist."
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null
      }
      throw err
    }
  }
  async deleteAvatar(userId) {
    await prisma.profile.updateMany({
      where: {
        user_id: userId,
      },
      data: {
        avatar: null,
      },
    })
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })

    if (!user) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile?.last_seen || undefined,
    }
  }
  async updateLastSeen(userId) {
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        profile: {
          update: {
            last_seen: new Date(),
          },
        },
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    if (!updatedUser) {
      return null
    }
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      bio: updatedUser.profile.bio || undefined,
      avatar: updatedUser.profile.avatar || undefined,
      lastSeen: updatedUser.profile.last_seen || undefined,
    }
  }
  async search(query) {
    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 50,
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      bio: user.profile.bio || undefined,
      avatar: user.profile.avatar || undefined,
      lastSeen: user.profile.last_seen || undefined,
    }))
  }

  async uploadAvatar(userId, url) {
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        profile: {
          update: {
            avatar: url,
          },
        },
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            bio: true,
            avatar: true,
            last_seen: true,
          },
        },
      },
    })
    if (!updatedUser) {
      return null
    }
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      bio: updatedUser.profile.bio || undefined,
      avatar: updatedUser.profile.avatar || undefined,
      lastSeen: updatedUser.profile.last_seen || undefined,
    }
  }
}

module.exports = new UserRepository()
