jest.mock('@repositories')
jest.mock('@config', () => ({
  env: {
    ACCESS_TOKEN_SECRET: 'test-secret-at-least-32-chars-long!!',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
  },
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
  postgres: { getPool: () => ({ query: jest.fn() }) },
  redis: { getClient: () => ({ set: jest.fn(), get: jest.fn(), del: jest.fn() }) },
}))

const jwt = require('jsonwebtoken')
const { tokenRepository } = require('@repositories')
const { AuthenticationError } = require('@errors')

// Re-require after mocks are in place
const tokenService = require('@services/token.service')

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'testuser',
  role: 'user',
}

beforeEach(() => {
  tokenRepository.saveRefreshToken.mockResolvedValue(undefined)
  tokenRepository.getUserIdByToken.mockResolvedValue(mockUser.id)
  tokenRepository.deleteRefreshToken.mockResolvedValue(undefined)
})

describe('tokenService.issueTokenPair', () => {
  it('returns accessToken and refreshToken', async () => {
    const { accessToken, refreshToken } = await tokenService.issueTokenPair(mockUser)
    expect(typeof accessToken).toBe('string')
    expect(typeof refreshToken).toBe('string')
  })

  it('accessToken is a valid JWT containing id, username, role, jti', async () => {
    const { accessToken } = await tokenService.issueTokenPair(mockUser)
    const payload = jwt.decode(accessToken)
    expect(payload.id).toBe(mockUser.id)
    expect(payload.username).toBe(mockUser.username)
    expect(payload.role).toBe(mockUser.role)
    expect(payload.jti).toBeDefined()
  })

  it('calls tokenRepository.saveRefreshToken with refreshToken, userId, and TTL seconds', async () => {
    const { refreshToken } = await tokenService.issueTokenPair(mockUser)
    expect(tokenRepository.saveRefreshToken).toHaveBeenCalledWith(
      refreshToken,
      mockUser.id,
      expect.any(Number)
    )
  })

  it('each call produces a unique refreshToken', async () => {
    const { refreshToken: rt1 } = await tokenService.issueTokenPair(mockUser)
    const { refreshToken: rt2 } = await tokenService.issueTokenPair(mockUser)
    expect(rt1).not.toBe(rt2)
  })
})

describe('tokenService.verifyAccessToken', () => {
  it('returns decoded payload for a valid token', async () => {
    const { accessToken } = await tokenService.issueTokenPair(mockUser)
    const payload = tokenService.verifyAccessToken(accessToken)
    expect(payload.id).toBe(mockUser.id)
  })

  it('throws AuthenticationError with INVALID_TOKEN for a malformed token', () => {
    expect(() => tokenService.verifyAccessToken('not.a.valid.jwt')).toThrow(AuthenticationError)
    try {
      tokenService.verifyAccessToken('not.a.valid.jwt')
    } catch (err) {
      expect(err.code).toBe('INVALID_TOKEN')
    }
  })

  it('throws AuthenticationError with TOKEN_EXPIRED for an expired token', () => {
    const expired = jwt.sign({ id: mockUser.id }, 'test-secret-at-least-32-chars-long!!', {
      expiresIn: '-1s',
    })
    try {
      tokenService.verifyAccessToken(expired)
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError)
      expect(err.code).toBe('TOKEN_EXPIRED')
    }
  })
})

describe('tokenService.getUserId', () => {
  it('returns userId when token exists in repository', async () => {
    tokenRepository.getUserIdByToken.mockResolvedValue(mockUser.id)
    const userId = await tokenService.getUserId('valid-refresh-token')
    expect(userId).toBe(mockUser.id)
  })

  it('throws AuthenticationError with REFRESH_TOKEN_REVOKED when token does not exist', async () => {
    tokenRepository.getUserIdByToken.mockResolvedValue(null)
    await expect(tokenService.getUserId('unknown-token')).rejects.toThrow(AuthenticationError)
    try {
      await tokenService.getUserId('unknown-token')
    } catch (err) {
      expect(err.code).toBe('REFRESH_TOKEN_REVOKED')
    }
  })
})

describe('tokenService.rotateTokens', () => {
  it('deletes the old refresh token', async () => {
    await tokenService.rotateTokens('old-token', mockUser)
    expect(tokenRepository.deleteRefreshToken).toHaveBeenCalledWith('old-token')
  })

  it('issues a new token pair', async () => {
    const { accessToken, refreshToken } = await tokenService.rotateTokens('old-token', mockUser)
    expect(typeof accessToken).toBe('string')
    expect(typeof refreshToken).toBe('string')
  })

  it('returns different tokens than the old one', async () => {
    const { refreshToken } = await tokenService.rotateTokens('old-token', mockUser)
    expect(refreshToken).not.toBe('old-token')
  })
})

describe('tokenService.revokeSession', () => {
  it('deletes the refresh token from repository when it exists', async () => {
    tokenRepository.getUserIdByToken.mockResolvedValue(mockUser.id)
    await tokenService.revokeSession('valid-token')
    expect(tokenRepository.deleteRefreshToken).toHaveBeenCalledWith('valid-token')
  })

  it('throws AuthenticationError with SESSION_NOT_FOUND when token is missing', async () => {
    tokenRepository.getUserIdByToken.mockResolvedValue(null)
    await expect(tokenService.revokeSession('ghost-token')).rejects.toThrow(AuthenticationError)
    try {
      await tokenService.revokeSession('ghost-token')
    } catch (err) {
      expect(err.code).toBe('SESSION_NOT_FOUND')
    }
  })
})
