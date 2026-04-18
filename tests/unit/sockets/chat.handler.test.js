const { SOCKET_EVENTS } = require('@constants')

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }

jest.mock('@config', () => ({ logger: mockLogger }))

const chatHandler = require('@sockets/handlers/chat.handler')

const makeSocket = (overrides = {}) => {
  const handlers = {}
  return {
    id: 'socket-id-123',
    userId: 'user-id-abc',
    join: jest.fn(),
    leave: jest.fn(),
    on: jest.fn((event, cb) => {
      handlers[event] = cb
    }),
    _trigger: (event, data) => handlers[event]?.(data),
    ...overrides,
  }
}

describe('chatHandler', () => {
  let socket

  beforeEach(() => {
    jest.clearAllMocks()
    socket = makeSocket()
    chatHandler({}, socket)
  })

  describe('event registration', () => {
    it('registers chat:join handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.CHAT_JOIN, expect.any(Function))
    })

    it('registers chat:leave handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.CHAT_LEAVE, expect.any(Function))
    })

    it('registers exactly two event listeners', () => {
      expect(socket.on).toHaveBeenCalledTimes(2)
    })
  })

  describe('joinChat', () => {
    it('joins the socket room with the given chatId', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-1' })
      expect(socket.join).toHaveBeenCalledWith('chat-1')
    })

    it('logs info with socketId, userId, and chatId', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-1' })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User joined chat',
        expect.objectContaining({ socketId: socket.id, userId: socket.userId, chatId: 'chat-1' })
      )
    })

    it('handles different chatId values', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-xyz-999' })
      expect(socket.join).toHaveBeenCalledWith('chat-xyz-999')
    })

    it('does not call leave when joining', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-1' })
      expect(socket.leave).not.toHaveBeenCalled()
    })
  })

  describe('leaveChat', () => {
    it('leaves the socket room with the given chatId', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_LEAVE, { chatId: 'chat-2' })
      expect(socket.leave).toHaveBeenCalledWith('chat-2')
    })

    it('logs info with socketId, userId, and chatId', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_LEAVE, { chatId: 'chat-2' })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User left chat',
        expect.objectContaining({ socketId: socket.id, userId: socket.userId, chatId: 'chat-2' })
      )
    })

    it('does not call join when leaving', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_LEAVE, { chatId: 'chat-2' })
      expect(socket.join).not.toHaveBeenCalled()
    })

    it('handles different chatId values', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_LEAVE, { chatId: 'another-chat' })
      expect(socket.leave).toHaveBeenCalledWith('another-chat')
    })
  })

  describe('multiple operations', () => {
    it('can join and then leave the same chat', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-3' })
      socket._trigger(SOCKET_EVENTS.CHAT_LEAVE, { chatId: 'chat-3' })
      expect(socket.join).toHaveBeenCalledWith('chat-3')
      expect(socket.leave).toHaveBeenCalledWith('chat-3')
    })

    it('can join multiple chats independently', () => {
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-a' })
      socket._trigger(SOCKET_EVENTS.CHAT_JOIN, { chatId: 'chat-b' })
      expect(socket.join).toHaveBeenCalledTimes(2)
      expect(socket.join).toHaveBeenNthCalledWith(1, 'chat-a')
      expect(socket.join).toHaveBeenNthCalledWith(2, 'chat-b')
    })
  })
})
