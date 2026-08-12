const crypto = require('crypto')
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { createTestUsers, expectError, expectSuccess } = require('./helpers')
const { Chat } = require('@models')
const { CHAT_TYPES } = require('@constants')

describe('POST /api/v1/messages', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  it('lazily creates a private chat on first direct message', async () => {
    const [alice, bob] = await createTestUsers(2)

    const chatsBefore = await Chat.countDocuments({})
    expect(chatsBefore).toBe(0)

    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: bob.user.id, content: 'Hey Bob!' })

    expectSuccess(response, StatusCodes.CREATED, 'Message sent successfully')
    expect(response.body.data.message.content).toBe('Hey Bob!')
    expect(response.body.data.message.sender).toBe(alice.user.id)
    expect(response.body.data.chat.type).toBe(CHAT_TYPES.PRIVATE)
    expect(response.body.data.chat.participants).toEqual(
      expect.arrayContaining([alice.user.id, bob.user.id])
    )

    const chatsAfter = await Chat.countDocuments({})
    expect(chatsAfter).toBe(1)
  })

  it('reuses the same chat for subsequent messages between the same pair', async () => {
    const [alice, bob] = await createTestUsers(2)

    const first = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: bob.user.id, content: 'first' })
    expectSuccess(first, StatusCodes.CREATED)
    const chatIdFromAlice = first.body.data.chat.id

    // Bob replies via direct endpoint — should land in the same chat
    const second = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${bob.tokens.accessToken}`)
      .send({ peerId: alice.user.id, content: 'second' })
    expectSuccess(second, StatusCodes.CREATED)
    expect(second.body.data.chat.id).toBe(chatIdFromAlice)

    // Alice sends again
    const third = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: bob.user.id, content: 'third' })
    expectSuccess(third, StatusCodes.CREATED)
    expect(third.body.data.chat.id).toBe(chatIdFromAlice)

    expect(await Chat.countDocuments({})).toBe(1)
  })

  it('does not create a duplicate chat under concurrent first-messages', async () => {
    const [alice, bob] = await createTestUsers(2)

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
        .send({ peerId: bob.user.id, content: 'from alice' }),
      request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${bob.tokens.accessToken}`)
        .send({ peerId: alice.user.id, content: 'from bob' }),
    ])

    expectSuccess(resA, StatusCodes.CREATED)
    expectSuccess(resB, StatusCodes.CREATED)
    expect(resA.body.data.chat.id).toBe(resB.body.data.chat.id)
    expect(await Chat.countDocuments({})).toBe(1)
  })

  it('reuses the same chat created via POST /api/v1/chats', async () => {
    const [alice, bob] = await createTestUsers(2)

    const created = await request(app)
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ type: CHAT_TYPES.PRIVATE, participants: [bob.user.id] })
    expectSuccess(created, StatusCodes.CREATED)
    const existingChatId = created.body.data.chat.id

    const direct = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: bob.user.id, content: 'hi' })
    expectSuccess(direct, StatusCodes.CREATED)
    expect(direct.body.data.chat.id).toBe(existingChatId)
    expect(await Chat.countDocuments({})).toBe(1)
  })

  it('rejects sending to self', async () => {
    const [alice] = await createTestUsers(1)

    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: alice.user.id, content: 'hi me' })

    expectError(response, StatusCodes.BAD_REQUEST, 'INVALID_PEER')
  })

  it('rejects when peer does not exist', async () => {
    const [alice] = await createTestUsers(1)

    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: crypto.randomUUID(), content: 'hi ghost' })

    expectError(response, StatusCodes.BAD_REQUEST, 'USER_NOT_FOUND')
  })

  it('rejects malformed peerId', async () => {
    const [alice] = await createTestUsers(1)

    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: 'not-a-uuid', content: 'hi' })

    expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
  })

  it('rejects empty content', async () => {
    const [alice, bob] = await createTestUsers(2)

    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      .send({ peerId: bob.user.id, content: '' })

    expectError(response, StatusCodes.BAD_REQUEST, 'VALIDATION_FAILED')
  })

  it('requires authentication', async () => {
    const [_, bob] = await createTestUsers(2)

    const response = await request(app)
      .post('/api/v1/messages')
      .send({ peerId: bob.user.id, content: 'hi' })

    expectError(response, StatusCodes.UNAUTHORIZED)
  })
})
