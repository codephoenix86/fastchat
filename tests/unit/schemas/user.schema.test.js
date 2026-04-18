const { updateCurrentUser, changePassword, getUserById } = require('@schemas/user.schema')

const validate = (schema, input) => schema.validate(input, { abortEarly: false })

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('user.schema — updateCurrentUser', () => {
  it('passes with valid username', () => {
    const { error } = validate(updateCurrentUser, { body: { username: 'newuser1' } })
    expect(error).toBeUndefined()
  })

  it('passes with valid bio', () => {
    const { error } = validate(updateCurrentUser, { body: { bio: 'Hello world' } })
    expect(error).toBeUndefined()
  })

  it('passes with both username and bio', () => {
    const { error } = validate(updateCurrentUser, {
      body: { username: 'newuser1', bio: 'Hello world' },
    })
    expect(error).toBeUndefined()
  })

  it('rejects empty body object', () => {
    const { error } = validate(updateCurrentUser, { body: {} })
    expect(error).toBeDefined()
  })

  it('rejects username shorter than 3 characters', () => {
    const { error } = validate(updateCurrentUser, { body: { username: 'ab' } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects username longer than 20 characters', () => {
    const { error } = validate(updateCurrentUser, { body: { username: 'a'.repeat(21) } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects bio longer than 200 characters', () => {
    const { error } = validate(updateCurrentUser, { body: { bio: 'a'.repeat(201) } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('bio'))).toBe(true)
  })
})

describe('user.schema — changePassword', () => {
  const validPayload = {
    body: { currentPassword: 'OldPass@1', newPassword: 'NewPass@2' },
  }

  it('passes with valid currentPassword and newPassword', () => {
    const { error } = validate(changePassword, validPayload)
    expect(error).toBeUndefined()
  })

  it('rejects missing currentPassword', () => {
    const { error } = validate(changePassword, { body: { newPassword: 'NewPass@2' } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('currentPassword'))).toBe(true)
  })

  it('rejects missing newPassword', () => {
    const { error } = validate(changePassword, { body: { currentPassword: 'OldPass@1' } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('newPassword'))).toBe(true)
  })

  it('rejects newPassword identical to currentPassword', () => {
    const { error } = validate(changePassword, {
      body: { currentPassword: 'SamePass@1', newPassword: 'SamePass@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('newPassword'))).toBe(true)
  })

  it('rejects newPassword shorter than 8 characters', () => {
    const { error } = validate(changePassword, {
      body: { currentPassword: 'OldPass@1', newPassword: 'Sh@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('newPassword'))).toBe(true)
  })

  it('rejects newPassword failing complexity requirements', () => {
    const { error } = validate(changePassword, {
      body: { currentPassword: 'OldPass@1', newPassword: 'alllowercase1@' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('newPassword'))).toBe(true)
  })
})

describe('user.schema — getUserById', () => {
  it('passes with a valid UUID userId param', () => {
    const { error } = validate(getUserById, { params: { userId: VALID_UUID } })
    expect(error).toBeUndefined()
  })

  it('rejects non-UUID userId', () => {
    const { error } = validate(getUserById, { params: { userId: 'not-a-uuid' } })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('userId'))).toBe(true)
  })
})
