jest.unmock('@services/s3.service')

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input, type: 'PutObjectCommand' })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, type: 'DeleteObjectCommand' })),
}))
jest.mock('@config', () => ({
  s3: { getClient: jest.fn() },
  env: {
    S3_ENABLED: true,
    S3_BUCKET_NAME: 'test-bucket',
    AWS_REGION: 'ap-south1',
  },
}))

const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { s3, env } = require('@config')
const s3Service = require('@services/s3.service')

describe('S3Service', () => {
  const s3Client = { send: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    s3.getClient.mockReturnValue(s3Client)
  })

  describe('uploadFile', () => {
    const buffer = Buffer.from('file-content')
    const filename = 'avatars/user-123.jpg'
    const mimetype = 'image/jpeg'

    it('should send a PutObjectCommand with correct params', async () => {
      s3Client.send.mockResolvedValue({})

      await s3Service.uploadFile(buffer, filename, mimetype)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      })
      expect(s3Client.send).toHaveBeenCalledTimes(1)
      expect(s3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PutObjectCommand' })
      )
    })

    it('should throw when s3Client.send rejects', async () => {
      s3Client.send.mockRejectedValue(new Error('S3 upload error'))

      await expect(s3Service.uploadFile(buffer, filename, mimetype)).rejects.toThrow(
        'S3 upload error'
      )
    })

    it('should use the bucket name from env config', async () => {
      s3Client.send.mockResolvedValue({})

      await s3Service.uploadFile(buffer, filename, mimetype)

      const [[constructorArg]] = PutObjectCommand.mock.calls
      expect(constructorArg.Bucket).toBe('test-bucket')
    })
  })

  describe('deleteFile', () => {
    const filename = 'avatars/user-123.jpg'
    const prefix = `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/`
    it('should send a DeleteObjectCommand with correct params', async () => {
      s3Client.send.mockResolvedValue({})

      await s3Service.deleteFile(prefix + filename)

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: filename,
      })
      expect(s3Client.send).toHaveBeenCalledTimes(1)
      expect(s3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DeleteObjectCommand' })
      )
    })

    it('should throw when s3Client.send rejects', async () => {
      s3Client.send.mockRejectedValue(new Error('S3 delete error'))

      await expect(s3Service.deleteFile(prefix + filename)).rejects.toThrow('S3 delete error')
    })

    it('should use the bucket name from env config', async () => {
      s3Client.send.mockResolvedValue({})

      await s3Service.deleteFile(prefix + filename)

      const [[constructorArg]] = DeleteObjectCommand.mock.calls
      expect(constructorArg.Bucket).toBe('test-bucket')
    })
  })
})
