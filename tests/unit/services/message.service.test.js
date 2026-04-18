jest.mock('@repositories')
jest.mock('@config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
  postgres: { getPool: () => ({ query: jest.fn() }) },
  redis: { getClient: () => ({ set: jest.fn(), get: jest.fn(), del: jest.fn() }) },
}))

const { messageRepository, chatRepository } = require('@repositories')
const { NotFoundError, AuthorizationError } = require('@errors')
const { MESSAGE_STATUS } = require('@constants')

const messageService = require('@services/message.service')

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const CHAT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MSG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'

const makeChat = (participants = [USER_ID]) => ({
  _id: CHAT_ID,
  participants,
})

const makeMessage = (sender = USER_ID) => ({
  _id: MSG_ID,
  content: 'Hello',
  sender,
  chat: CHAT_ID,
  status: MESSAGE_STATUS.SENT,
  type: 'text',
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('messageService.sendMessage', () => {
  it('creates and returns a formatted message', async () => {
    const chat = makeChat([USER_ID])
    const msg = makeMessage()
    chatRepository.findById.mockResolvedValue(chat)
    messageRepository.create.mockResolvedValue(msg)

    const result = await messageService.sendMessage({ content: 'Hello', chatId: CHAT_ID }, USER_ID)

    expect(result.id).toBe(MSG_ID)
    expect(result.content).toBe('Hello')
  })

  it('calls messageRepository.create with correct fields', async () => {
    chatRepository.findById.mockResolvedValue(makeChat([USER_ID]))
    messageRepository.create.mockResolvedValue(makeMessage())

    await messageService.sendMessage({ content: 'Hi', chatId: CHAT_ID }, USER_ID)

    expect(messageRepository.create).toHaveBeenCalledWith({
      content: 'Hi',
      sender: USER_ID,
      chat: CHAT_ID,
      status: MESSAGE_STATUS.SENT,
    })
  })

  it('throws NotFoundError when chat does not exist', async () => {
    chatRepository.findById.mockResolvedValue(null)
    await expect(
      messageService.sendMessage({ content: 'Hi', chatId: CHAT_ID }, USER_ID)
    ).rejects.toThrow(NotFoundError)
  })

  it('throws AuthorizationError when sender is not a participant', async () => {
    chatRepository.findById.mockResolvedValue(makeChat([OTHER_ID]))
    await expect(
      messageService.sendMessage({ content: 'Hi', chatId: CHAT_ID }, USER_ID)
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('messageService.getChatMessages', () => {
  it('returns messages and total count', async () => {
    chatRepository.findById.mockResolvedValue(makeChat([USER_ID]))
    messageRepository.countDocuments.mockResolvedValue(5)
    messageRepository.findAllWithPopulate.mockResolvedValue([makeMessage()])

    const result = await messageService.getChatMessages(CHAT_ID, USER_ID, {})

    expect(result.total).toBe(5)
    expect(result.messages).toHaveLength(1)
  })

  it('throws NotFoundError when chat does not exist', async () => {
    chatRepository.findById.mockResolvedValue(null)
    await expect(messageService.getChatMessages(CHAT_ID, USER_ID)).rejects.toThrow(NotFoundError)
  })

  it('throws AuthorizationError when user is not a participant', async () => {
    chatRepository.findById.mockResolvedValue(makeChat([OTHER_ID]))
    await expect(messageService.getChatMessages(CHAT_ID, USER_ID)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('messageService.getMessageById', () => {
  it('returns formatted message when found and user is participant', async () => {
    const msg = makeMessage()
    messageRepository.findByIdWithPopulate.mockResolvedValue(msg)
    chatRepository.findById.mockResolvedValue(makeChat([USER_ID]))

    const result = await messageService.getMessageById(MSG_ID, CHAT_ID, USER_ID)
    expect(result.id).toBe(MSG_ID)
  })

  it('throws NotFoundError when message does not exist', async () => {
    messageRepository.findByIdWithPopulate.mockResolvedValue(null)
    await expect(messageService.getMessageById(MSG_ID, CHAT_ID, USER_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it('throws NotFoundError when message belongs to a different chat', async () => {
    messageRepository.findByIdWithPopulate.mockResolvedValue(makeMessage())
    await expect(messageService.getMessageById(MSG_ID, 'wrong-chat-id', USER_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it('throws AuthorizationError when user is not a chat participant', async () => {
    messageRepository.findByIdWithPopulate.mockResolvedValue(makeMessage())
    chatRepository.findById.mockResolvedValue(makeChat([OTHER_ID]))
    await expect(messageService.getMessageById(MSG_ID, CHAT_ID, USER_ID)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('messageService.updateMessage', () => {
  it('updates and returns the message when user is the sender', async () => {
    const msg = makeMessage(USER_ID)
    messageRepository.findById.mockResolvedValue(msg)

    const result = await messageService.updateMessage(MSG_ID, USER_ID, 'Edited')

    expect(msg.save).toHaveBeenCalled()
    expect(result.content).toBe('Edited')
  })

  it('throws NotFoundError when message does not exist', async () => {
    messageRepository.findById.mockResolvedValue(null)
    await expect(messageService.updateMessage(MSG_ID, USER_ID, 'Edited')).rejects.toThrow(
      NotFoundError
    )
  })

  it('throws AuthorizationError when user is not the sender', async () => {
    messageRepository.findById.mockResolvedValue(makeMessage(OTHER_ID))
    await expect(messageService.updateMessage(MSG_ID, USER_ID, 'Edited')).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('messageService.deleteMessage', () => {
  it('deletes message when user is the sender', async () => {
    messageRepository.findById.mockResolvedValue(makeMessage(USER_ID))
    messageRepository.findByIdAndDelete.mockResolvedValue(undefined)

    await messageService.deleteMessage(MSG_ID, USER_ID)

    expect(messageRepository.findByIdAndDelete).toHaveBeenCalledWith(MSG_ID)
  })

  it('throws NotFoundError when message does not exist', async () => {
    messageRepository.findById.mockResolvedValue(null)
    await expect(messageService.deleteMessage(MSG_ID, USER_ID)).rejects.toThrow(NotFoundError)
  })

  it('throws AuthorizationError when user is not the sender', async () => {
    messageRepository.findById.mockResolvedValue(makeMessage(OTHER_ID))
    await expect(messageService.deleteMessage(MSG_ID, USER_ID)).rejects.toThrow(AuthorizationError)
  })
})

describe('messageService.updateMessageStatus', () => {
  it('updates status to delivered successfully', async () => {
    const msg = makeMessage()
    msg.status = MESSAGE_STATUS.DELIVERED
    messageRepository.findByIdAndUpdate.mockResolvedValue(msg)

    const result = await messageService.updateMessageStatus(MSG_ID, MESSAGE_STATUS.DELIVERED)
    expect(result.status).toBe(MESSAGE_STATUS.DELIVERED)
  })

  it('throws NotFoundError when message does not exist', async () => {
    messageRepository.findByIdAndUpdate.mockResolvedValue(null)
    await expect(messageService.updateMessageStatus(MSG_ID, MESSAGE_STATUS.READ)).rejects.toThrow(
      NotFoundError
    )
  })
})

describe('messageService.getPendingMessages', () => {
  it('returns sent-status messages for the user', async () => {
    chatRepository.findAll.mockResolvedValue([makeChat([USER_ID])])
    messageRepository.findAllWithPopulate.mockResolvedValue([makeMessage()])

    const result = await messageService.getPendingMessages(USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe(MESSAGE_STATUS.SENT)
  })

  it('returns empty array when user has no chats', async () => {
    chatRepository.findAll.mockResolvedValue([])
    messageRepository.findAllWithPopulate.mockResolvedValue([])

    const result = await messageService.getPendingMessages(USER_ID)
    expect(result).toHaveLength(0)
  })
})

describe('messageService.formatMessage', () => {
  it('returns null when message is null', () => {
    expect(messageService.formatMessage(null)).toBeNull()
  })

  it('returns correct shape', () => {
    const msg = makeMessage()
    const result = messageService.formatMessage(msg)
    expect(result).toMatchObject({
      id: MSG_ID,
      content: 'Hello',
      sender: USER_ID,
      chat: CHAT_ID,
      status: MESSAGE_STATUS.SENT,
      type: 'text',
    })
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })
})
