const { S3Client } = require('@aws-sdk/client-s3')
const env = require('./env')

let client = null

const getClient = () => {
  if (!env.S3_ENABLED) {
    return null
  }
  if (!client) {
    client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  return client
}

module.exports = { getClient }
