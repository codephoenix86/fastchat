jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
}))

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock('@config/logger', () => mockLogger)

describe('S3 config — getClient', () => {
  let getClient
  let S3Client
  let mockEnv

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockEnv = {
      S3_ENABLED: false,
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'AKID',
      AWS_SECRET_ACCESS_KEY: 'secret',
    }

    jest.doMock('@config/env', () => mockEnv)
    jest.doMock('@aws-sdk/client-s3', () => ({
      S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
    }))
    jest.doMock('@config/logger', () => mockLogger)

    getClient = require('@config/s3').getClient
    S3Client = require('@aws-sdk/client-s3').S3Client
  })

  describe('when S3_ENABLED is false', () => {
    it('returns null without instantiating S3Client', () => {
      mockEnv.S3_ENABLED = false
      const result = getClient()
      expect(result).toBeNull()
      expect(S3Client).not.toHaveBeenCalled()
    })
  })

  describe('when S3_ENABLED is true', () => {
    beforeEach(() => {
      mockEnv.S3_ENABLED = true
    })

    it('instantiates and returns an S3Client', () => {
      const client = getClient()
      expect(S3Client).toHaveBeenCalledTimes(1)
      expect(client).not.toBeNull()
    })

    it('passes correct region and credentials to S3Client', () => {
      getClient()
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'AKID',
            secretAccessKey: 'secret',
          },
        })
      )
    })

    it('reuses the same client on subsequent calls (singleton)', () => {
      const first = getClient()
      const second = getClient()
      expect(S3Client).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    })

    it('passes a logger plugin to S3Client', () => {
      getClient()
      const [[{ logger }]] = S3Client.mock.calls
      expect(logger).toBeDefined()
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })
  })

  describe('sdkLogger plugin', () => {
    beforeEach(() => {
      mockEnv.S3_ENABLED = true
    })

    const getSdkLogger = () => {
      getClient()
      const [[{ logger }]] = S3Client.mock.calls
      return logger
    }

    it('sdkLogger.trace is a no-op', () => {
      const sdkLogger = getSdkLogger()
      expect(() => sdkLogger.trace('x')).not.toThrow()
    })

    it('sdkLogger.debug is a no-op', () => {
      const sdkLogger = getSdkLogger()
      expect(() => sdkLogger.debug('x')).not.toThrow()
    })

    it('sdkLogger.info is a no-op', () => {
      const sdkLogger = getSdkLogger()
      expect(() => sdkLogger.info('x')).not.toThrow()
    })

    it('sdkLogger.warn calls logger.warn with string content', () => {
      const sdkLogger = getSdkLogger()
      sdkLogger.warn('something went wrong')
      expect(mockLogger.warn).toHaveBeenCalledWith('S3 client', { message: 'something went wrong' })
    })

    it('sdkLogger.warn calls logger.warn with object content directly', () => {
      const sdkLogger = getSdkLogger()
      const obj = { code: 'NetworkError', message: 'timeout' }
      sdkLogger.warn(obj)
      expect(mockLogger.warn).toHaveBeenCalledWith('S3 client', obj)
    })

    it('sdkLogger.error calls logger.error with structured error info', () => {
      const sdkLogger = getSdkLogger()
      const err = new Error('S3 put failed')
      sdkLogger.error({
        clientName: 'S3Client',
        commandName: 'PutObjectCommand',
        metadata: { requestId: 'abc' },
        error: err,
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'S3 request error',
        expect.objectContaining({
          clientName: 'S3Client',
          commandName: 'PutObjectCommand',
          error: err.message,
          stack: err.stack,
          name: err.name,
        })
      )
    })

    it('sdkLogger.error handles null content gracefully', () => {
      const sdkLogger = getSdkLogger()
      expect(() => sdkLogger.error(null)).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'S3 request error',
        expect.objectContaining({ error: undefined })
      )
    })

    it('sdkLogger.error handles content without error field', () => {
      const sdkLogger = getSdkLogger()
      sdkLogger.error({ clientName: 'S3Client', commandName: 'GetObject' })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'S3 request error',
        expect.objectContaining({ clientName: 'S3Client', error: undefined })
      )
    })

    it('sdkLogger.error handles string content', () => {
      const sdkLogger = getSdkLogger()
      expect(() => sdkLogger.error('plain string error')).not.toThrow()
    })
  })
})
