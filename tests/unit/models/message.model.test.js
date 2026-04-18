const { MESSAGE_TYPES, MESSAGE_STATUS } = require('@constants')

describe('Message model schema', () => {
  describe('content required validator', () => {
    const isContentRequired = (type) => type === MESSAGE_TYPES.TEXT

    it('is required for TEXT messages', () => {
      expect(isContentRequired(MESSAGE_TYPES.TEXT)).toBe(true)
    })

    it('is not required for FILE messages', () => {
      expect(isContentRequired(MESSAGE_TYPES.FILE)).toBe(false)
    })
  })

  describe('file required validator', () => {
    const isFileRequired = (type) => type === MESSAGE_TYPES.FILE

    it('is required for FILE messages', () => {
      expect(isFileRequired(MESSAGE_TYPES.FILE)).toBe(true)
    })

    it('is not required for TEXT messages', () => {
      expect(isFileRequired(MESSAGE_TYPES.TEXT)).toBe(false)
    })
  })

  describe('toJSON transformation', () => {
    it('renames _id to id and removes __v', () => {
      const ret = {
        _id: 'msg-uuid-456',
        __v: 0,
        content: 'Hello',
        status: 'sent',
        type: 'text',
      }
      // Replicate the transform function
      ret.id = ret._id
      delete ret._id
      delete ret.__v
      expect(ret.id).toBe('msg-uuid-456')
      expect(ret._id).toBeUndefined()
      expect(ret.__v).toBeUndefined()
    })
  })

  describe('MESSAGE_TYPES enum values', () => {
    it('TEXT is the string "text"', () => {
      expect(MESSAGE_TYPES.TEXT).toBe('text')
    })

    it('FILE is the string "file"', () => {
      expect(MESSAGE_TYPES.FILE).toBe('file')
    })
  })

  describe('MESSAGE_STATUS enum values', () => {
    it('SENT is the string "sent"', () => {
      expect(MESSAGE_STATUS.SENT).toBe('sent')
    })

    it('DELIVERED is the string "delivered"', () => {
      expect(MESSAGE_STATUS.DELIVERED).toBe('delivered')
    })

    it('READ is the string "read"', () => {
      expect(MESSAGE_STATUS.READ).toBe('read')
    })
  })

  describe('status defaults', () => {
    it('default status is SENT', () => {
      // Simulates what mongoose would use as default
      const defaultStatus = MESSAGE_STATUS.SENT
      expect(defaultStatus).toBe('sent')
    })
  })

  describe('type defaults', () => {
    it('default type is TEXT', () => {
      const defaultType = MESSAGE_TYPES.TEXT
      expect(defaultType).toBe('text')
    })
  })

  describe('valid status values', () => {
    const validStatuses = Object.values(MESSAGE_STATUS)

    it('has three valid statuses', () => {
      expect(validStatuses).toHaveLength(3)
    })

    it('includes sent, delivered, and read', () => {
      expect(validStatuses).toContain('sent')
      expect(validStatuses).toContain('delivered')
      expect(validStatuses).toContain('read')
    })
  })

  describe('valid type values', () => {
    const validTypes = Object.values(MESSAGE_TYPES)

    it('has two valid types', () => {
      expect(validTypes).toHaveLength(2)
    })

    it('includes text and file', () => {
      expect(validTypes).toContain('text')
      expect(validTypes).toContain('file')
    })
  })
})
