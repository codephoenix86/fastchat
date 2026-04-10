const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { s3, env } = require('@config')

const getPrefix = () => `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/`

class S3Service {
  async uploadFile(buffer, filename, mimetype) {
    const s3Client = s3.getClient()
    if (!s3Client) {
      throw new Error('S3 is disabled (set S3_ENABLED=true to enable)')
    }

    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: mimetype,
    })
    await s3Client.send(command)
    return getPrefix() + filename
  }

  async deleteFile(url) {
    const s3Client = s3.getClient()
    if (!s3Client) {
      return
    }

    const prefix = getPrefix()
    const filename = url.slice(prefix.length)
    const command = new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: filename,
    })
    await s3Client.send(command)
  }
}

module.exports = new S3Service()
