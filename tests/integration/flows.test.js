/**
 * End-to-end flow integration tests.
 * These tests simulate realistic multi-step user journeys across the full API stack.
 */
const request = require('supertest')
const app = require('@/app')
const { connectTestDB, clearTestDB, disconnectTestDB } = require('@tests/helpers')
const { StatusCodes } = require('http-status-codes')
const { Chat, Message } = require('@models')
const { CHAT_TYPES } = require('@constants')
const {
  createTestUser,
  createTestUsers,
  expectError,
  expectSuccess,
  generateUsername,
  generateEmail,
} = require('./helpers')

describe('End-to-End Flows', () => {
  beforeAll(async () => {
    await connectTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  afterAll(async () => {
    await disconnectTestDB()
  })

  describe('Full user registration and chat lifecycle', () => {
    it('should complete signup → login → create chat → send messages → delete account', async () => {
      // Step 1: Sign up two users
      const user1Data = {
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password@123',
      }
      const user2Data = {
        username: generateUsername(),
        email: generateEmail(),
        password: 'Password@123',
      }

      const signup1 = await request(app).post('/api/v1/auth/signup').send(user1Data)
      expectSuccess(signup1, StatusCodes.CREATED)
      const user1Id = signup1.body.data.user.id

      const signup2 = await request(app).post('/api/v1/auth/signup').send(user2Data)
      expectSuccess(signup2, StatusCodes.CREATED)
      const user2Id = signup2.body.data.user.id

      // Step 2: Login both users
      const login1 = await request(app).post('/api/v1/auth/login').send({
        username: user1Data.username,
        password: 'Password@123',
      })
      expectSuccess(login1, StatusCodes.OK)
      const { accessToken: token1, refreshToken: refresh1 } = login1.body.data

      const login2 = await request(app).post('/api/v1/auth/login').send({
        username: user2Data.username,
        password: 'Password@123',
      })
      expectSuccess(login2, StatusCodes.OK)
      const { accessToken: token2 } = login2.body.data

      // Step 3: Create private chat between users
      const createChat = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${token1}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: [user2Id] })
      expectSuccess(createChat, StatusCodes.CREATED)
      const chatId = createChat.body.data.chat.id

      // Step 4: Both users send messages
      const msg1 = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ content: 'Hello from user1!' })
      expectSuccess(msg1, StatusCodes.CREATED)
      expect(msg1.body.data.message.sender).toBe(user1Id)

      const msg2 = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ content: 'Hello back from user2!' })
      expectSuccess(msg2, StatusCodes.CREATED)
      expect(msg2.body.data.message.sender).toBe(user2Id)

      // Step 5: User1 reads the conversation
      const messages = await request(app)
        .get(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
      expectSuccess(messages, StatusCodes.OK)
      expect(messages.body.pagination.total).toBe(2)

      // Step 6: User1 edits their message
      const messageId = msg1.body.data.message.id
      const editMsg = await request(app)
        .patch(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ content: 'Hello (edited)!' })
      expectSuccess(editMsg, StatusCodes.OK)
      expect(editMsg.body.data.message.content).toBe('Hello (edited)!')

      // Step 7: User1 deletes their message
      const deleteMsg = await request(app)
        .delete(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${token1}`)
      expectSuccess(deleteMsg, StatusCodes.OK)

      const msgAfterDelete = await Message.findById(messageId)
      expect(msgAfterDelete).toBeNull()

      // Step 8: Logout user1
      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .type('form')
        .send({ refresh_token: refresh1 })
      expectSuccess(logout, StatusCodes.OK)

      // Step 9: After logout, old refresh token should be invalid
      const refreshAfterLogout = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: refresh1 })
      expectError(refreshAfterLogout, StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED')
    })
  })

  describe('Group chat lifecycle', () => {
    it('should create group, manage members, transfer admin, and dissolve', async () => {
      const [user1, user2, user3] = await createTestUsers(3)

      // Create group chat
      const createGroup = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'Project Team',
          participants: [user2.user.id, user3.user.id],
        })
      expectSuccess(createGroup, StatusCodes.CREATED)
      const chatId = createGroup.body.data.chat.id
      expect(createGroup.body.data.chat.admin).toBe(user1.user.id)
      expect(createGroup.body.data.chat.participants).toHaveLength(3)

      // All members send messages
      for (const { user, tokens } of [user1, user2, user3]) {
        const send = await request(app)
          .post(`/api/v1/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .send({ content: `Message from ${user.username}` })
        expectSuccess(send, StatusCodes.CREATED)
      }

      // Verify 3 messages
      const msgList = await request(app)
        .get(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
      expect(msgList.body.pagination.total).toBe(3)

      // Rename the group
      const rename = await request(app)
        .patch(`/api/v1/chats/${chatId}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ groupName: 'Renamed Team' })
      expectSuccess(rename, StatusCodes.OK)
      expect(rename.body.data.chat.name).toBe('Renamed Team')

      // Transfer admin to user2
      const transfer = await request(app)
        .patch(`/api/v1/chats/${chatId}`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .send({ admin: user2.user.id })
      expectSuccess(transfer, StatusCodes.OK)
      expect(transfer.body.data.chat.admin).toBe(user2.user.id)

      // Original admin (user1) leaves
      const leave1 = await request(app)
        .delete(`/api/v1/chats/${chatId}/members/me`)
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
      expectSuccess(leave1, StatusCodes.OK)

      // Verify members list has 2 left
      const members = await request(app)
        .get(`/api/v1/chats/${chatId}/members`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
      expectSuccess(members, StatusCodes.OK)
      expect(members.body.data.members).toHaveLength(2)

      // New admin (user2) removes user3
      const kickUser3 = await request(app)
        .delete(`/api/v1/chats/${chatId}/members/${user3.user.id}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
      expectSuccess(kickUser3, StatusCodes.OK)

      // user2 is now the last member — leaving should delete the chat
      const leaveAndDelete = await request(app)
        .delete(`/api/v1/chats/${chatId}/members/me`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
      expectSuccess(leaveAndDelete, StatusCodes.OK)

      const deletedChat = await Chat.findById(chatId)
      expect(deletedChat).toBeNull()

      // All messages should also be gone (if cascaded) or chat simply not accessible
      const getDeletedChat = await request(app)
        .get(`/api/v1/chats/${chatId}`)
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
      expectError(getDeletedChat, StatusCodes.NOT_FOUND, 'NOT_FOUND')
    })
  })

  describe('Token rotation flow', () => {
    it('should allow multiple sequential token refreshes', async () => {
      const { tokens } = await createTestUser()

      // First refresh
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })
      expectSuccess(refresh1, StatusCodes.OK)
      const newTokens1 = refresh1.body.data

      // Old refresh token must now be revoked
      const replayOld = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: tokens.refreshToken })
      expectError(replayOld, StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED')

      // New token must work
      const refresh2 = await request(app)
        .post('/api/v1/auth/refresh')
        .type('form')
        .send({ refresh_token: newTokens1.refreshToken })
      expectSuccess(refresh2, StatusCodes.OK)
      expect(refresh2.body.data.accessToken).not.toBe(newTokens1.accessToken)
    })
  })

  describe('Profile update flow', () => {
    it('should update username and verify the change is reflected everywhere', async () => {
      const { user, tokens } = await createTestUser()
      const newUsername = generateUsername()

      // Update username
      const update = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ username: newUsername })
      expectSuccess(update, StatusCodes.OK)
      expect(update.body.data.user.username).toBe(newUsername)

      // Get current user — should reflect new username
      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
      expectSuccess(me, StatusCodes.OK)
      expect(me.body.data.user.username).toBe(newUsername)

      // Get by ID — should reflect new username
      const byId = await request(app).get(`/api/v1/users/${user.id}`)
      expectSuccess(byId, StatusCodes.OK)
      expect(byId.body.data.user.username).toBe(newUsername)

      // Search by new username
      const search = await request(app).get('/api/v1/users').query({ search: newUsername })
      expectSuccess(search, StatusCodes.OK)
      expect(search.body.pagination.total).toBe(1)
      expect(search.body.data[0].username).toBe(newUsername)
    })
  })

  describe('Password change flow', () => {
    it('should change password and allow login with new password only', async () => {
      const { user, tokens } = await createTestUser()

      // Change password
      const changePw = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: 'Password@123', newPassword: 'NewPassword@456' })
      expectSuccess(changePw, StatusCodes.OK)

      // Login with old password should fail
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: user.username, password: 'Password@123' })
      expectError(oldLogin, StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS')

      // Login with new password should succeed
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: user.username, password: 'NewPassword@456' })
      expectSuccess(newLogin, StatusCodes.OK)
      expect(newLogin.body.data.accessToken).toBeDefined()
    })
  })

  describe('Account deletion flow', () => {
    it('should delete account and deny all subsequent protected access', async () => {
      const { user, tokens } = await createTestUser()

      // Delete account
      const del = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
      expectSuccess(del, StatusCodes.OK)

      // Access token should still be valid (JWT — stateless), but user no longer exists
      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
      expectError(me, StatusCodes.NOT_FOUND, 'NOT_FOUND')

      // Public user lookup should 404
      const byId = await request(app).get(`/api/v1/users/${user.id}`)
      expectError(byId, StatusCodes.NOT_FOUND, 'NOT_FOUND')

      // Login should fail
      const loginAfterDelete = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: user.username, password: 'Password@123' })
      expectError(loginAfterDelete, StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS')
    })
  })

  describe('Multi-user private chat messaging flow', () => {
    it('should allow two users to have a full back-and-forth conversation', async () => {
      const [alice, bob] = await createTestUsers(2)

      // Alice creates chat with Bob
      const chatRes = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
        .send({ type: CHAT_TYPES.PRIVATE, participants: [bob.user.id] })
      const chatId = chatRes.body.data.chat.id

      const conversation = [
        { user: alice, content: 'Hey Bob!' },
        { user: bob, content: 'Hey Alice!' },
        { user: alice, content: 'How are you?' },
        { user: bob, content: "I'm good, thanks!" },
        { user: alice, content: 'Great to hear!' },
      ]

      const sentIds = []
      for (const { user: u, content } of conversation) {
        const actor = u.id === alice.user.id ? alice : bob
        const res = await request(app)
          .post(`/api/v1/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${actor.tokens.accessToken}`)
          .send({ content })
        expectSuccess(res, StatusCodes.CREATED)
        sentIds.push(res.body.data.message.id)
      }

      // Verify all 5 messages exist
      const all = await request(app)
        .get(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      expect(all.body.pagination.total).toBe(5)

      // Alice can retrieve individual messages
      const single = await request(app)
        .get(`/api/v1/chats/${chatId}/messages/${sentIds[0]}`)
        .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
      expectSuccess(single, StatusCodes.OK)
      expect(single.body.data.message.content).toBe('Hey Bob!')

      // Bob can also retrieve individual messages
      const bobSingle = await request(app)
        .get(`/api/v1/chats/${chatId}/messages/${sentIds[1]}`)
        .set('Authorization', `Bearer ${bob.tokens.accessToken}`)
      expectSuccess(bobSingle, StatusCodes.OK)
      expect(bobSingle.body.data.message.content).toBe('Hey Alice!')
    })
  })

  describe('Group member management flow', () => {
    it('should add and remove members and verify access changes', async () => {
      const [admin, member, outsider] = await createTestUsers(3)

      // Create group
      const group = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
        .send({
          type: CHAT_TYPES.GROUP,
          groupName: 'Exclusive Club',
          participants: [member.user.id],
        })
      const chatId = group.body.data.chat.id

      // Outsider cannot see the chat
      const outsiderGet = await request(app)
        .get(`/api/v1/chats/${chatId}`)
        .set('Authorization', `Bearer ${outsider.tokens.accessToken}`)
      expectError(outsiderGet, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')

      // Admin adds outsider
      const addOutsider = await request(app)
        .post(`/api/v1/chats/${chatId}/members/${outsider.user.id}`)
        .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
      expectSuccess(addOutsider, StatusCodes.OK)

      // Outsider can now see the chat and send messages
      const outsiderSend = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${outsider.tokens.accessToken}`)
        .send({ content: 'Hello everyone!' })
      expectSuccess(outsiderSend, StatusCodes.CREATED)

      // Admin removes outsider
      const removeOutsider = await request(app)
        .delete(`/api/v1/chats/${chatId}/members/${outsider.user.id}`)
        .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
      expectSuccess(removeOutsider, StatusCodes.OK)

      // Outsider can no longer send messages
      const outsiderSendAfterRemove = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${outsider.tokens.accessToken}`)
        .send({ content: 'Still here?' })
      expectError(outsiderSendAfterRemove, StatusCodes.FORBIDDEN, 'NOT_A_MEMBER')
    })
  })
})
