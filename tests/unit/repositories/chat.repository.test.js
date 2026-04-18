const crypto = require('crypto')

jest.mock('@models', () => {
  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
  }

  const Chat = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(() => mockQuery),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exists: jest.fn(),
    _mockQuery: mockQuery,
  }

  return { Chat, Message: {} }
})

const chatRepository = require('@repositories/chat.repository')
const { Chat } = require('@models')

const makeChat = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  type: 'private',
  participants: [crypto.randomUUID(), crypto.randomUUID()],
  createdAt: new Date(),
  ...overrides,
})

describe('ChatRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-attach chained mock methods after clearAllMocks
    Chat._mockQuery.sort.mockReturnThis()
    Chat._mockQuery.skip.mockReturnThis()
    Chat._mockQuery.limit.mockReturnThis()
    Chat._mockQuery.populate.mockReturnThis()
    Chat.find.mockReturnValue(Chat._mockQuery)
  })

  describe('create', () => {
    it('calls Chat.create with provided data', async () => {
      const chatData = makeChat()
      Chat.create.mockResolvedValue(chatData)
      const result = await chatRepository.create(chatData)
      expect(Chat.create).toHaveBeenCalledWith(chatData)
      expect(result).toEqual(chatData)
    })

    it('propagates errors from Chat.create', async () => {
      Chat.create.mockRejectedValue(new Error('validation failed'))
      await expect(chatRepository.create({})).rejects.toThrow('validation failed')
    })
  })

  describe('findById', () => {
    it('calls Chat.findById with the chatId', async () => {
      const chatId = crypto.randomUUID()
      const chat = makeChat({ _id: chatId })
      Chat.findById.mockResolvedValue(chat)
      const result = await chatRepository.findById(chatId)
      expect(Chat.findById).toHaveBeenCalledWith(chatId)
      expect(result._id).toBe(chatId)
    })

    it('returns null when chat not found', async () => {
      Chat.findById.mockResolvedValue(null)
      const result = await chatRepository.findById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findByIdWithPopulate', () => {
    it('calls findById and populate with given fields', async () => {
      const chatId = crypto.randomUUID()
      const chat = makeChat({ _id: chatId })
      const populateFields = [{ path: 'participants', select: 'username' }]

      // findById returns object with .populate method
      const mockWithPopulate = { populate: jest.fn().mockResolvedValue(chat) }
      Chat.findById.mockReturnValue(mockWithPopulate)

      const result = await chatRepository.findByIdWithPopulate(chatId, populateFields)

      expect(Chat.findById).toHaveBeenCalledWith(chatId)
      expect(mockWithPopulate.populate).toHaveBeenCalledWith(populateFields)
      expect(result).toEqual(chat)
    })
  })

  describe('findAll', () => {
    it('chains sort, skip, limit on Chat.find', async () => {
      const chats = [makeChat(), makeChat()]
      Chat._mockQuery.limit.mockResolvedValue(chats)

      const result = await chatRepository.findAll({ participants: 'user-1' })

      expect(Chat.find).toHaveBeenCalledWith({ participants: 'user-1' })
      expect(Chat._mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(Chat._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Chat._mockQuery.limit).toHaveBeenCalledWith(20)
      expect(result).toEqual(chats)
    })

    it('applies custom skip, limit, and sort from options', async () => {
      Chat._mockQuery.limit.mockResolvedValue([])
      await chatRepository.findAll({}, { skip: 10, limit: 5, sort: { createdAt: 1 } })

      expect(Chat._mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 })
      expect(Chat._mockQuery.skip).toHaveBeenCalledWith(10)
      expect(Chat._mockQuery.limit).toHaveBeenCalledWith(5)
    })

    it('uses default values when options object is empty', async () => {
      Chat._mockQuery.limit.mockResolvedValue([])
      await chatRepository.findAll({}, {})

      expect(Chat._mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(Chat._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Chat._mockQuery.limit).toHaveBeenCalledWith(20)
    })
  })

  describe('findAllWithPopulate', () => {
    it('chains sort, skip, limit, populate on Chat.find', async () => {
      const chats = [makeChat()]
      Chat._mockQuery.populate.mockResolvedValue(chats)

      const populateFields = [{ path: 'participants' }]
      const result = await chatRepository.findAllWithPopulate(
        { participants: 'u1' },
        { skip: 0, limit: 10 },
        populateFields
      )

      expect(Chat.find).toHaveBeenCalledWith({ participants: 'u1' })
      expect(Chat._mockQuery.sort).toHaveBeenCalled()
      expect(Chat._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Chat._mockQuery.limit).toHaveBeenCalledWith(10)
      expect(Chat._mockQuery.populate).toHaveBeenCalledWith(populateFields)
      expect(result).toEqual(chats)
    })

    it('uses default options when not provided', async () => {
      Chat._mockQuery.populate.mockResolvedValue([])
      await chatRepository.findAllWithPopulate({}, {}, [])
      expect(Chat._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Chat._mockQuery.limit).toHaveBeenCalledWith(20)
    })
  })

  describe('countDocuments', () => {
    it('calls Chat.countDocuments with the query', async () => {
      Chat.countDocuments.mockResolvedValue(42)
      const result = await chatRepository.countDocuments({ participants: 'u1' })
      expect(Chat.countDocuments).toHaveBeenCalledWith({ participants: 'u1' })
      expect(result).toBe(42)
    })

    it('returns 0 for an empty collection', async () => {
      Chat.countDocuments.mockResolvedValue(0)
      const result = await chatRepository.countDocuments({})
      expect(result).toBe(0)
    })
  })

  describe('findByIdAndUpdate', () => {
    it('calls Chat.findByIdAndUpdate with new:true by default', async () => {
      const chatId = crypto.randomUUID()
      const updated = makeChat({ _id: chatId, groupName: 'New Name' })
      Chat.findByIdAndUpdate.mockResolvedValue(updated)

      const result = await chatRepository.findByIdAndUpdate(chatId, {
        $set: { groupName: 'New Name' },
      })

      expect(Chat.findByIdAndUpdate).toHaveBeenCalledWith(
        chatId,
        { $set: { groupName: 'New Name' } },
        { new: true }
      )
      expect(result.groupName).toBe('New Name')
    })

    it('merges additional options with new:true', async () => {
      const chatId = crypto.randomUUID()
      Chat.findByIdAndUpdate.mockResolvedValue(makeChat())
      await chatRepository.findByIdAndUpdate(chatId, {}, { upsert: true })

      expect(Chat.findByIdAndUpdate).toHaveBeenCalledWith(chatId, {}, { new: true, upsert: true })
    })

    it('returns null when chatId not found', async () => {
      Chat.findByIdAndUpdate.mockResolvedValue(null)
      const result = await chatRepository.findByIdAndUpdate('nonexistent', {})
      expect(result).toBeNull()
    })
  })

  describe('findByIdAndDelete', () => {
    it('calls Chat.findByIdAndDelete with the chatId', async () => {
      const chatId = crypto.randomUUID()
      const deleted = makeChat({ _id: chatId })
      Chat.findByIdAndDelete.mockResolvedValue(deleted)

      const result = await chatRepository.findByIdAndDelete(chatId)

      expect(Chat.findByIdAndDelete).toHaveBeenCalledWith(chatId)
      expect(result).toEqual(deleted)
    })

    it('returns null when chat does not exist', async () => {
      Chat.findByIdAndDelete.mockResolvedValue(null)
      const result = await chatRepository.findByIdAndDelete('ghost')
      expect(result).toBeNull()
    })
  })

  describe('exists', () => {
    it('calls Chat.exists with the query', async () => {
      Chat.exists.mockResolvedValue({ _id: 'some-id' })
      const result = await chatRepository.exists({
        participants: { $all: ['u1', 'u2'] },
        type: 'private',
      })

      expect(Chat.exists).toHaveBeenCalledWith(expect.objectContaining({ type: 'private' }))
      expect(result).toBeTruthy()
    })

    it('returns null when no match', async () => {
      Chat.exists.mockResolvedValue(null)
      const result = await chatRepository.exists({ _id: 'nonexistent' })
      expect(result).toBeNull()
    })
  })
})
