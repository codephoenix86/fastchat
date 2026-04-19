const { S3Client } = require('@aws-sdk/client-s3')
const env = require('./env')
const logger = require('./logger')

let client = null

// AWS SDK logger adapter — only surface warn/error to keep logs clean.
const sdkLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: (content) =>
    logger.warn('S3 warning', typeof content === 'object' ? content : { message: content }),
  error: (content) =>
    logger.error('S3 request error', {
      clientName: content?.clientName,
      commandName: content?.commandName,
      err: content?.error ?? (content instanceof Error ? content : undefined),
    }),
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
