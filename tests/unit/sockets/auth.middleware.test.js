const { AuthenticationError } = require('@errors')

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
const mockTokenService = { verifyAccessToken: jest.fn() }

jest.mock('@config', () => ({ logger: mockLogger }))
jest.mock('@services', () => ({ tokenService: mockTokenService }))

const authenticate = require('@sockets/middlewares/auth.middleware')

const makeSocket = (overrides = {}) => ({
  id: 'socket-id-001',
  handshake: { auth: {}, headers: {}, address: '127.0.0.1' },
  userId: undefined,
  ...overrides,
})

describe('socket authenticate middleware', () => {
  let next

  beforeEach(() => {
    jest.clearAllMocks()
    next = jest.fn()
  })

  describe('missing token', () => {
    it('calls next with AuthenticationError when no token provided', () => {
      authenticate(makeSocket(), next)
      expect(next).toHaveBeenCalledTimes(1)
      expect(next.mock.calls[0][0]).toBeInstanceOf(AuthenticationError)
    })

    it('passes MISSING_TOKEN code when token absent', () => {
      authenticate(makeSocket(), next)
      expect(next.mock.calls[0][0].code).toBe('MISSING_TOKEN')
    })

    it('logs a warning when token is missing', () => {
      const socket = makeSocket()
      authenticate(socket, next)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Socket connection attempt without token',
        expect.objectContaining({ socketId: socket.id, address: socket.handshake.address })
      )
    })

    it('does not call tokenService.verifyAccessToken when token is missing', () => {
      authenticate(makeSocket(), next)
      expect(mockTokenService.verifyAccessToken).not.toHaveBeenCalled()
    })
  })

  describe('token from handshake.auth', () => {
    it('verifies the token from auth object', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'user-123' })
      const socket = makeSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token')
    })

    it('attaches userId to socket on success', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'user-xyz' })
      const socket = makeSocket({
        handshake: { auth: { token: 'token-abc' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(socket.userId).toBe('user-xyz')
    })

    it('calls next() without error on success', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'user-abc' })
      const socket = makeSocket({
        handshake: { auth: { token: 'good-token' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(next).toHaveBeenCalledWith()
      expect(next).toHaveBeenCalledTimes(1)
    })

    it('logs debug on successful authentication', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'user-debug' })
      const socket = makeSocket({
        handshake: { auth: { token: 'tok' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Socket authenticated',
        expect.objectContaining({ socketId: socket.id, userId: 'user-debug' })
      )
    })
  })

  describe('token from handshake.headers', () => {
    it('falls back to headers.token when auth.token is absent', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'user-header' })
      const socket = makeSocket({
        handshake: { auth: {}, headers: { token: 'header-token' }, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('header-token')
      expect(socket.userId).toBe('user-header')
    })

    it('calls next without error when header token is valid', () => {
      mockTokenService.verifyAccessToken.mockReturnValue({ id: 'from-header' })
      const socket = makeSocket({
        handshake: { auth: {}, headers: { token: 'hdr-tok' }, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(next).toHaveBeenCalledWith()
    })
  })

  describe('invalid / expired token', () => {
    it('calls next with a generic Error when verifyAccessToken throws', () => {
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('jwt expired')
      })
      const socket = makeSocket({
        handshake: { auth: { token: 'expired-token' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(next.mock.calls[0][0].message).toBe('jwt expired')
    })

    it('logs a warning on authentication failure', () => {
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid signature')
      })
      const socket = makeSocket({
        handshake: { auth: { token: 'bad-token' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Socket authentication failed',
        expect.objectContaining({ error: 'invalid signature', socketId: socket.id })
      )
    })

    it('does not attach userId when verification fails', () => {
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('malformed token')
      })
      const socket = makeSocket({
        handshake: { auth: { token: 'bad' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(socket.userId).toBeUndefined()
    })

    it('includes stack and name in warning log', () => {
      const err = new Error('jwt malformed')
      err.name = 'JsonWebTokenError'
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw err
      })
      const socket = makeSocket({
        handshake: { auth: { token: 'bad' }, headers: {}, address: '127.0.0.1' },
      })
      authenticate(socket, next)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Socket authentication failed',
        expect.objectContaining({ stack: err.stack, name: err.name })
      )
    })
  })
})
