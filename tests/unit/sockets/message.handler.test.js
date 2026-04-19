const { SOCKET_EVENTS } = require('@constants')

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }

jest.mock('@config', () => ({ logger: mockLogger }))

jest.mock('@services', () => ({
  messageService: { updateMessageStatus: jest.fn() },
}))

const messageHandler = require('@sockets/handlers/message.handler')
const { messageService } = require('@services')

const makeSocket = (overrides = {}) => {
  const handlers = {}
  return {
    id: 'socket-id-456',
    userId: 'user-id-def',
    on: jest.fn((event, cb) => {
      handlers[event] = cb
    }),
    _trigger: async (event, data) => {
      if (handlers[event]) {
        await handlers[event](data)
      }
    },
    ...overrides,
  }
}

describe('messageHandler', () => {
  let socket

  beforeEach(() => {
    jest.clearAllMocks()
    socket = makeSocket()
    messageHandler({}, socket)
  })

  describe('event registration', () => {
    it('registers message:delivered handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_DELIVERED, expect.any(Function))
    })

    it('registers message:read handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_READ, expect.any(Function))
    })

    it('registers exactly two event listeners', () => {
      expect(socket.on).toHaveBeenCalledTimes(2)
    })
  })

  describe('setMessageStatusToDelivered', () => {
    it('calls messageService.updateMessageStatus with delivered', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: 'msg-1' })
      expect(messageService.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'delivered')
    })

    it('does not log on success', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: 'msg-1' })
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })

    it('catches error and logs it without re-throwing', async () => {
      const err = new Error('db error')
      err.name = 'MongoError'
      messageService.updateMessageStatus.mockRejectedValue(err)
      await expect(
        socket._trigger(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: 'msg-fail' })
      ).resolves.toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update message status via socket',
        expect.objectContaining({ messageId: 'msg-fail', status: 'delivered', err })
      )
    })

    it('does not call read handler when delivered is triggered', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: 'msg-2' })
      expect(messageService.updateMessageStatus).toHaveBeenCalledTimes(1)
      expect(messageService.updateMessageStatus).toHaveBeenCalledWith('msg-2', 'delivered')
    })
  })

  describe('setMessageStatusToRead', () => {
    it('calls messageService.updateMessageStatus with read', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_READ, { messageId: 'msg-2' })
      expect(messageService.updateMessageStatus).toHaveBeenCalledWith('msg-2', 'read')
    })

    it('does not log on success', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_READ, { messageId: 'msg-2' })
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })

    it('catches error and logs it without re-throwing', async () => {
      const err = new Error('network timeout')
      err.name = 'TimeoutError'
      messageService.updateMessageStatus.mockRejectedValue(err)
      await expect(
        socket._trigger(SOCKET_EVENTS.MESSAGE_READ, { messageId: 'msg-fail-read' })
      ).resolves.toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update message status via socket',
        expect.objectContaining({ messageId: 'msg-fail-read', status: 'read', err })
      )
    })

    it('passes the Error object as err field in error log', async () => {
      const err = new Error('stack error')
      messageService.updateMessageStatus.mockRejectedValue(err)
      await socket._trigger(SOCKET_EVENTS.MESSAGE_READ, { messageId: 'msg-stack' })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update message status via socket',
        expect.objectContaining({ err })
      )
    })
  })

  describe('edge cases', () => {
    it('handles sequential delivered and read events for different messages', async () => {
      messageService.updateMessageStatus.mockResolvedValue({})
      await socket._trigger(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: 'msg-a' })
      await socket._trigger(SOCKET_EVENTS.MESSAGE_READ, { messageId: 'msg-b' })
      expect(messageService.updateMessageStatus).toHaveBeenCalledTimes(2)
      expect(messageService.updateMessageStatus).toHaveBeenNthCalledWith(1, 'msg-a', 'delivered')
      expect(messageService.updateMessageStatus).toHaveBeenNthCalledWith(2, 'msg-b', 'read')
    })
  })
})
