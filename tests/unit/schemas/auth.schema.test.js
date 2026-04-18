const { signup, login, logout, refreshToken } = require('@schemas/auth.schema')

const validate = (schema, input) => schema.validate(input, { abortEarly: false })

const VALID_SIGNUP = {
  body: {
    email: 'user@example.com',
    username: 'testuser1',
    password: 'Password@1',
  },
}

describe('auth.schema — signup', () => {
  it('passes with valid email, username, and password', () => {
    const { error } = validate(signup, VALID_SIGNUP)
    expect(error).toBeUndefined()
  })

  it('rejects missing email', () => {
    const { error } = validate(signup, {
      body: { username: 'testuser1', password: 'Password@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('email'))).toBe(true)
  })

  it('rejects invalid email format', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, email: 'not-an-email' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('email'))).toBe(true)
  })

  it('rejects missing username', () => {
    const { error } = validate(signup, {
      body: { email: 'user@example.com', password: 'Password@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects username shorter than 3 characters', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, username: 'ab' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects username longer than 20 characters', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, username: 'a'.repeat(21) },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects username starting with a non-letter', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, username: '1invalid' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('username'))).toBe(true)
  })

  it('rejects missing password', () => {
    const { error } = validate(signup, {
      body: { email: 'user@example.com', username: 'testuser1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('password'))).toBe(true)
  })

  it('rejects password shorter than 8 characters', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, password: 'Pa@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('password'))).toBe(true)
  })

  it('rejects password missing uppercase letter', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, password: 'password@1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('password'))).toBe(true)
  })

  it('rejects password missing special character', () => {
    const { error } = validate(signup, {
      body: { ...VALID_SIGNUP.body, password: 'Password1' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('password'))).toBe(true)
  })

  it('lowercases and trims email', () => {
    const { value } = validate(signup, {
      body: { ...VALID_SIGNUP.body, email: '  USER@EXAMPLE.COM  ' },
    })
    expect(value.body.email).toBe('user@example.com')
  })
})

describe('auth.schema — login', () => {
  it('passes with email and password', () => {
    const { error } = validate(login, {
      body: { email: 'user@example.com', password: 'Password@1' },
    })
    expect(error).toBeUndefined()
  })

  it('passes with username and password', () => {
    const { error } = validate(login, {
      body: { username: 'testuser1', password: 'Password@1' },
    })
    expect(error).toBeUndefined()
  })

  it('rejects when both email and username are provided', () => {
    const { error } = validate(login, {
      body: { email: 'user@example.com', username: 'testuser1', password: 'Password@1' },
    })
    expect(error).toBeDefined()
  })

  it('rejects when neither email nor username is provided', () => {
    const { error } = validate(login, {
      body: { password: 'Password@1' },
    })
    expect(error).toBeDefined()
  })

  it('rejects missing password', () => {
    const { error } = validate(login, {
      body: { email: 'user@example.com' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('password'))).toBe(true)
  })
})

describe('auth.schema — logout', () => {
  const validLogout = {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { refresh_token: 'some-opaque-token' },
  }

  it('passes with valid refresh_token and correct content-type', () => {
    const { error } = validate(logout, validLogout)
    expect(error).toBeUndefined()
  })

  it('rejects missing refresh_token', () => {
    const { error } = validate(logout, {
      ...validLogout,
      body: {},
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('refresh_token'))).toBe(true)
  })

  it('rejects wrong content-type header', () => {
    const { error } = validate(logout, {
      headers: { 'content-type': 'application/json' },
      body: { refresh_token: 'token' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content-type'))).toBe(true)
  })
})

describe('auth.schema — refreshToken', () => {
  const validRefresh = {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { refresh_token: 'some-opaque-token' },
  }

  it('passes with valid refresh_token and correct content-type', () => {
    const { error } = validate(refreshToken, validRefresh)
    expect(error).toBeUndefined()
  })

  it('rejects missing refresh_token', () => {
    const { error } = validate(refreshToken, {
      ...validRefresh,
      body: {},
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('refresh_token'))).toBe(true)
  })

  it('rejects wrong content-type header', () => {
    const { error } = validate(refreshToken, {
      headers: { 'content-type': 'application/json' },
      body: { refresh_token: 'token' },
    })
    expect(error).toBeDefined()
    expect(error.details.some((d) => d.path.includes('content-type'))).toBe(true)
  })
})
