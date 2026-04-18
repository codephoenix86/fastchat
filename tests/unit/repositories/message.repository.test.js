const crypto = require('crypto')

jest.mock('@models', () => {
  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
  }

  const Message = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(() => mockQuery),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateOne: jest.fn(),
    _mockQuery: mockQuery,
  }

  return { Chat: {}, Message }
})

const messageRepository = require('@repositories/message.repository')
const { Message } = require('@models')

const makeMessage = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  content: 'Hello world',
  sender: crypto.randomUUID(),
  chat: crypto.randomUUID(),
  status: 'sent',
  type: 'text',
  createdAt: new Date(),
  ...overrides,
})

describe('MessageRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Message._mockQuery.sort.mockReturnThis()
    Message._mockQuery.skip.mockReturnThis()
    Message._mockQuery.limit.mockReturnThis()
    Message._mockQuery.populate.mockReturnThis()
    Message.find.mockReturnValue(Message._mockQuery)
  })

  describe('create', () => {
    it('calls Message.create with provided data', async () => {
      const msgData = makeMessage()
      Message.create.mockResolvedValue(msgData)
      const result = await messageRepository.create(msgData)
      expect(Message.create).toHaveBeenCalledWith(msgData)
      expect(result).toEqual(msgData)
    })

    it('propagates validation errors', async () => {
      Message.create.mockRejectedValue(new Error('content required'))
      await expect(messageRepository.create({})).rejects.toThrow('content required')
    })
  })

  describe('findById', () => {
    it('calls Message.findById with the messageId', async () => {
      const msgId = crypto.randomUUID()
      const msg = makeMessage({ _id: msgId })
      Message.findById.mockResolvedValue(msg)
      const result = await messageRepository.findById(msgId)
      expect(Message.findById).toHaveBeenCalledWith(msgId)
      expect(result._id).toBe(msgId)
    })

    it('returns null when not found', async () => {
      Message.findById.mockResolvedValue(null)
      const result = await messageRepository.findById('ghost-id')
      expect(result).toBeNull()
    })
  })

  describe('findByIdWithPopulate', () => {
    it('chains populate on findById', async () => {
      const msgId = crypto.randomUUID()
      const msg = makeMessage({ _id: msgId })
      const populateFields = [{ path: 'sender', select: 'username' }]
      const mockWithPopulate = { populate: jest.fn().mockResolvedValue(msg) }
      Message.findById.mockReturnValue(mockWithPopulate)

      const result = await messageRepository.findByIdWithPopulate(msgId, populateFields)

      expect(Message.findById).toHaveBeenCalledWith(msgId)
      expect(mockWithPopulate.populate).toHaveBeenCalledWith(populateFields)
      expect(result).toEqual(msg)
    })
  })

  describe('findAll', () => {
    it('chains sort, skip, limit on Message.find with defaults', async () => {
      const messages = [makeMessage(), makeMessage()]
      Message._mockQuery.limit.mockResolvedValue(messages)

      const result = await messageRepository.findAll({ chat: 'chat-1' })

      expect(Message.find).toHaveBeenCalledWith({ chat: 'chat-1' })
      expect(Message._mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 })
      expect(Message._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Message._mockQuery.limit).toHaveBeenCalledWith(50)
      expect(result).toEqual(messages)
    })

    it('applies custom skip, limit, and sort', async () => {
      Message._mockQuery.limit.mockResolvedValue([])
      await messageRepository.findAll({}, { skip: 20, limit: 10, sort: { createdAt: -1 } })
      expect(Message._mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(Message._mockQuery.skip).toHaveBeenCalledWith(20)
      expect(Message._mockQuery.limit).toHaveBeenCalledWith(10)
    })

    it('uses defaults when options is empty object', async () => {
      Message._mockQuery.limit.mockResolvedValue([])
      await messageRepository.findAll({}, {})
      expect(Message._mockQuery.skip).toHaveBeenCalledWith(0)
      expect(Message._mockQuery.limit).toHaveBeenCalledWith(50)
    })
  })

  describe('findAllWithPopulate', () => {
    it('chains populate, sort, skip, limit on Message.find', async () => {
      const messages = [makeMessage()]
      // In MessageRepository.findAllWithPopulate the chain is: find().populate().sort().skip().limit()
      // After clearAllMocks, rebuild the chain so limit resolves
      Message._mockQuery.limit.mockResolvedValue(messages)
      const populateFields = [{ path: 'sender' }]

      const result = await messageRepository.findAllWithPopulate(
        { chat: 'c1' },
        { skip: 0, limit: 25 },
        populateFields
      )

      expect(Message.find).toHaveBeenCalledWith({ chat: 'c1' })
      expect(Message._mockQuery.populate).toHaveBeenCalledWith(populateFields)
      expect(result).toEqual(messages)
    })

    it('uses default limit of 50 when not specified', async () => {
      Message._mockQuery.limit.mockResolvedValue([])
      await messageRepository.findAllWithPopulate({}, {}, [])
      expect(Message._mockQuery.limit).toHaveBeenCalledWith(50)
    })
  })

  describe('countDocuments', () => {
    it('calls Message.countDocuments with query', async () => {
      Message.countDocuments.mockResolvedValue(15)
      const result = await messageRepository.countDocuments({ chat: 'chat-1' })
      expect(Message.countDocuments).toHaveBeenCalledWith({ chat: 'chat-1' })
      expect(result).toBe(15)
    })

    it('returns 0 when no messages', async () => {
      Message.countDocuments.mockResolvedValue(0)
      const result = await messageRepository.countDocuments({ chat: 'empty' })
      expect(result).toBe(0)
    })
  })

  describe('findByIdAndUpdate', () => {
    it('calls findByIdAndUpdate with new:true by default', async () => {
      const msgId = crypto.randomUUID()
      const updated = makeMessage({ _id: msgId, status: 'delivered' })
      Message.findByIdAndUpdate.mockResolvedValue(updated)

      const result = await messageRepository.findByIdAndUpdate(msgId, {
        $set: { status: 'delivered' },
      })

      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(
        msgId,
        { $set: { status: 'delivered' } },
        { new: true }
      )
      expect(result.status).toBe('delivered')
    })

    it('merges extra options with new:true', async () => {
      const msgId = crypto.randomUUID()
      Message.findByIdAndUpdate.mockResolvedValue(makeMessage())
      await messageRepository.findByIdAndUpdate(msgId, {}, { upsert: true })
      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(msgId, {}, { new: true, upsert: true })
    })

    it('returns null when message not found', async () => {
      Message.findByIdAndUpdate.mockResolvedValue(null)
      const result = await messageRepository.findByIdAndUpdate('nonexistent', {})
      expect(result).toBeNull()
    })
  })

  describe('findByIdAndDelete', () => {
    it('calls Message.findByIdAndDelete with the messageId', async () => {
      const msgId = crypto.randomUUID()
      const deleted = makeMessage({ _id: msgId })
      Message.findByIdAndDelete.mockResolvedValue(deleted)

      const result = await messageRepository.findByIdAndDelete(msgId)

      expect(Message.findByIdAndDelete).toHaveBeenCalledWith(msgId)
      expect(result).toEqual(deleted)
    })

    it('returns null when message not found', async () => {
      Message.findByIdAndDelete.mockResolvedValue(null)
      const result = await messageRepository.findByIdAndDelete('ghost')
      expect(result).toBeNull()
    })
  })

  describe('updateOne', () => {
    it('calls Message.updateOne with query and update data', async () => {
      const chatId = crypto.randomUUID()
      const updateResult = { modifiedCount: 3 }
      Message.updateOne.mockResolvedValue(updateResult)

      const result = await messageRepository.updateOne(
        { chat: chatId, status: 'sent' },
        { $set: { status: 'delivered' } }
      )

      expect(Message.updateOne).toHaveBeenCalledWith(
        { chat: chatId, status: 'sent' },
        { $set: { status: 'delivered' } }
      )
      expect(result).toEqual(updateResult)
    })

    it('propagates errors from updateOne', async () => {
      Message.updateOne.mockRejectedValue(new Error('update failed'))
      await expect(messageRepository.updateOne({}, {})).rejects.toThrow('update failed')
    })
  })
})
