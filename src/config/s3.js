const { S3Client } = require('@aws-sdk/client-s3')
const env = require('./env')
const logger = require('./logger')

let client = null

/** AWS SDK logger plugin: log failures like Redis/Postgres; skip success info (noisy per request). */
const sdkLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: (content) => {
    logger.warn('S3 client', typeof content === 'object' ? content : { message: content })
  },
  error: (content) => {
    const err = content && typeof content === 'object' ? content.error : null
    logger.error('S3 request error', {
      clientName: content?.clientName,
      commandName: content?.commandName,
      metadata: content?.metadata,
      error: err?.message,
      stack: err?.stack,
      name: err?.name,
    })
  },
}

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
      logger: sdkLogger,
    })
  }
  return client
}

module.exports = { getClient }
