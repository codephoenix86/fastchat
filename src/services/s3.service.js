const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { s3Client, env } = require('@config')

const prefix = `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/`

class S3Service {
  async uploadFile(buffer, filename, mimetype) {
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: mimetype,
    })
    await s3Client.send(command)
    return prefix + filename
  }

  async deleteFile(url) {
    const filename = url.slice(prefix.length)
    const command = new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: filename,
    })
    await s3Client.send(command)
  }
}

module.exports = new S3Service()
