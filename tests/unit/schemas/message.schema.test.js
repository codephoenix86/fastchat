const {
  sendMessage,
  updateMessage,
  getMessageById,
  deleteMessage,
} = require('@schemas/message.schema')

const validate = (schema, input) => schema.validate(input, { abortEarly: false })

const VALID_CHAT_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_MSG_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

describe('message.schema — sendMessage', () => {
  it('passes with valid chatId and content', () => {
    const { error } = validate(sendMessage, {
      params: { chatId: VALID_CHAT_UUID },
      body: { content: 'Hello world' },
    })
    expect(error).toBeUndefined()
  })

  it('rejects missing content', () => {
    const { error } = validate(sendMessage, {
      params: { chatId: VALID_CHAT_UUID },
      body: {},
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content'))).toBe(true)
  })

  it('rejects empty content', () => {
    const { error } = validate(sendMessage, {
      params: { chatId: VALID_CHAT_UUID },
      body: { content: '' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content'))).toBe(true)
  })

  it('rejects content exceeding 5000 characters', () => {
    const { error } = validate(sendMessage, {
      params: { chatId: VALID_CHAT_UUID },
      body: { content: 'a'.repeat(5001) },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content'))).toBe(true)
  })

  it('rejects non-UUID chatId', () => {
    const { error } = validate(sendMessage, {
      params: { chatId: 'not-a-uuid' },
      body: { content: 'Hi' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('chatId'))).toBe(true)
  })
})

describe('message.schema — updateMessage', () => {
  it('passes with valid messageId and content', () => {
    const { error } = validate(updateMessage, {
      params: { messageId: VALID_MSG_UUID },
      body: { content: 'Edited content' },
    })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID messageId', () => {
    const { error } = validate(updateMessage, {
      params: { messageId: 'bad-id' },
      body: { content: 'Hi' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('messageId'))).toBe(true)
  })

  it('rejects missing content', () => {
    const { error } = validate(updateMessage, {
      params: { messageId: VALID_MSG_UUID },
      body: {},
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content'))).toBe(true)
  })

  it('rejects empty content', () => {
    const { error } = validate(updateMessage, {
      params: { messageId: VALID_MSG_UUID },
      body: { content: '' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content'))).toBe(true)
  })
})

describe.each([
  ['getMessageById', getMessageById],
  ['deleteMessage', deleteMessage],
])('message.schema — %s', (name, schema) => {
  it('passes with valid chatId and messageId UUIDs', () => {
    const { error } = validate(schema, {
      params: { chatId: VALID_CHAT_UUID, messageId: VALID_MSG_UUID },
    })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID chatId', () => {
    const { error } = validate(schema, {
      params: { chatId: 'bad-id', messageId: VALID_MSG_UUID },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('chatId'))).toBe(true)
  })

  it('rejects non-UUID messageId', () => {
    const { error } = validate(schema, {
      params: { chatId: VALID_CHAT_UUID, messageId: 'bad-id' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('messageId'))).toBe(true)
  })
})
