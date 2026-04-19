const { SOCKET_EVENTS } = require('@constants')

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }

jest.mock('@config', () => ({ logger: mockLogger }))

const typingHandler = require('@sockets/handlers/typing.handler')

const makeSocket = (overrides = {}) => {
  const handlers = {}
  const toEmit = jest.fn()
  return {
    id: 'socket-id-789',
    userId: 'user-id-ghi',
    to: jest.fn(() => ({ emit: toEmit })),
    _toEmit: toEmit,
    on: jest.fn((event, cb) => {
      handlers[event] = cb
    }),
    _trigger: (event, data) => handlers[event]?.(data),
    ...overrides,
  }
}

describe('typingHandler', () => {
  let socket

  beforeEach(() => {
    jest.clearAllMocks()
    socket = makeSocket()
    typingHandler({}, socket)
  })

  describe('event registration', () => {
    it('registers message:start-typing handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING_START, expect.any(Function))
    })

    it('registers message:stop-typing handler', () => {
      expect(socket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING_STOP, expect.any(Function))
    })

    it('registers exactly two event listeners', () => {
      expect(socket.on).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleStartTyping', () => {
    it('broadcasts TYPING_START to the chat room', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-1' })
      expect(socket.to).toHaveBeenCalledWith('chat-1')
      expect(socket._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING_START, {
        userId: socket.userId,
        chatId: 'chat-1',
      })
    })

    it('does not log on typing start', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-1' })
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })

    it('uses socket.to (not socket.emit) so sender is excluded', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-1' })
      expect(socket.to).toHaveBeenCalledTimes(1)
    })

    it('includes the correct userId from socket in the emit payload', () => {
      socket.userId = 'specific-user-id'
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-x' })
      expect(socket._toEmit).toHaveBeenCalledWith(
        SOCKET_EVENTS.TYPING_START,
        expect.objectContaining({ userId: 'specific-user-id' })
      )
    })
  })

  describe('handleStopTyping', () => {
    it('broadcasts TYPING_STOP to the chat room', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_STOP, { chatId: 'chat-2' })
      expect(socket.to).toHaveBeenCalledWith('chat-2')
      expect(socket._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING_STOP, {
        userId: socket.userId,
        chatId: 'chat-2',
      })
    })

    it('does not log on typing stop', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_STOP, { chatId: 'chat-2' })
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })

    it('emits to the correct room', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_STOP, { chatId: 'room-99' })
      expect(socket.to).toHaveBeenCalledWith('room-99')
    })
  })

  describe('multiple operations', () => {
    it('handles start and stop typing in sequence', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-3' })
      socket._trigger(SOCKET_EVENTS.TYPING_STOP, { chatId: 'chat-3' })
      expect(socket.to).toHaveBeenCalledTimes(2)
      expect(socket._toEmit).toHaveBeenCalledTimes(2)
      expect(socket._toEmit).toHaveBeenNthCalledWith(
        1,
        SOCKET_EVENTS.TYPING_START,
        expect.any(Object)
      )
      expect(socket._toEmit).toHaveBeenNthCalledWith(
        2,
        SOCKET_EVENTS.TYPING_STOP,
        expect.any(Object)
      )
    })

    it('typing start in different chats broadcasts to respective rooms', () => {
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-a' })
      socket._trigger(SOCKET_EVENTS.TYPING_START, { chatId: 'chat-b' })
      expect(socket.to).toHaveBeenNthCalledWith(1, 'chat-a')
      expect(socket.to).toHaveBeenNthCalledWith(2, 'chat-b')
    })
  })
})
