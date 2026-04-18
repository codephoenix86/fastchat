const {
  createChat,
  getChatById,
  updateChat,
  addMember,
  removeMember,
  deleteChat,
  getMembers,
  removeSelf,
} = require('@schemas/chat.schema')

const validate = (schema, input) => schema.validate(input, { abortEarly: false })

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

describe('chat.schema — createChat', () => {
  it('passes for a valid private chat', () => {
    const { error } = validate(createChat, {
      body: { type: 'private', participants: [VALID_UUID] },
    })
    expect(error).toBeUndefined()
  })

  it('passes for a valid group chat', () => {
    const { error } = validate(createChat, {
      body: {
        type: 'group',
        groupName: 'My Group',
        participants: [VALID_UUID, VALID_UUID_2],
      },
    })
    expect(error).toBeUndefined()
  })

  it('rejects missing type', () => {
    const { error } = validate(createChat, {
      body: { participants: [VALID_UUID] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('type'))).toBe(true)
  })

  it('rejects missing participants', () => {
    const { error } = validate(createChat, {
      body: { type: 'private' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('participants'))).toBe(true)
  })

  it('rejects private chat with more than 1 other participant', () => {
    const { error } = validate(createChat, {
      body: { type: 'private', participants: [VALID_UUID, VALID_UUID_2] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('participants'))).toBe(true)
  })

  it('rejects group chat without groupName', () => {
    const { error } = validate(createChat, {
      body: { type: 'group', participants: [VALID_UUID, VALID_UUID_2] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('groupName'))).toBe(true)
  })

  it('rejects groupName on private chat', () => {
    const { error } = validate(createChat, {
      body: { type: 'private', groupName: 'Name', participants: [VALID_UUID] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('groupName'))).toBe(true)
  })

  it('rejects duplicate participants', () => {
    const { error } = validate(createChat, {
      body: { type: 'group', groupName: 'G', participants: [VALID_UUID, VALID_UUID] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('participants'))).toBe(true)
  })

  it('rejects invalid UUID in participants array', () => {
    const { error } = validate(createChat, {
      body: { type: 'private', participants: ['not-a-uuid'] },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('participants'))).toBe(true)
  })
})

describe.each([
  ['getChatById', getChatById],
  ['deleteChat', deleteChat],
  ['getMembers', getMembers],
  ['removeSelf', removeSelf],
])('chat.schema — %s', (name, schema) => {
  it('passes with a valid chatId UUID', () => {
    const { error } = validate(schema, { params: { chatId: VALID_UUID } })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID chatId', () => {
    const { error } = validate(schema, { params: { chatId: 'bad-id' } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('chatId'))).toBe(true)
  })
})

describe('chat.schema — updateChat', () => {
  it('passes with valid chatId and groupName', () => {
    const { error } = validate(updateChat, {
      params: { chatId: VALID_UUID },
      body: { groupName: 'New Name' },
    })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID chatId', () => {
    const { error } = validate(updateChat, {
      params: { chatId: 'bad-id' },
      body: { groupName: 'X' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('chatId'))).toBe(true)
  })
})

describe.each([
  ['addMember', addMember],
  ['removeMember', removeMember],
])('chat.schema — %s', (name, schema) => {
  it('passes with valid chatId and userId UUIDs', () => {
    const { error } = validate(schema, {
      params: { chatId: VALID_UUID, userId: VALID_UUID_2 },
    })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID chatId', () => {
    const { error } = validate(schema, {
      params: { chatId: 'bad-id', userId: VALID_UUID_2 },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('chatId'))).toBe(true)
  })

  it('rejects non-UUID userId', () => {
    const { error } = validate(schema, {
      params: { chatId: VALID_UUID, userId: 'bad-id' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('userId'))).toBe(true)
  })
})
