const { cleanEnv, str, port, url, num } = require('envalid')

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),
  PORT: port({ default: 3000 }),
  MONGODB_URI: url(),
  POSTGRES_URI: url(),
  REDIS_URI: url(),
  ACCESS_TOKEN_SECRET: str({ minLength: 32 }),
  ACCESS_TOKEN_TTL: str({ default: '15m' }),
  REFRESH_TOKEN_TTL: str({ default: '7d' }),
  ALLOWED_ORIGINS: str({ default: 'http://localhost:3000' }),
  LOG_LEVEL: str({
    choices: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  }),
  MAX_FILE_SIZE: num({ default: 5242880 }),
  AWS_REGION: str(),
  AWS_ACCESS_KEY_ID: str(),
  AWS_SECRET_ACCESS_KEY: str(),
  S3_BUCKET_NAME: str(),
})

module.exports = env
