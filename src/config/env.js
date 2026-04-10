const { cleanEnv, str, port, url, num, bool } = require('envalid')

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
  S3_ENABLED: bool({ default: false }),

  // S3 (conditionally required)
  AWS_REGION: str({ default: '' }),
  AWS_ACCESS_KEY_ID: str({ default: '' }),
  AWS_SECRET_ACCESS_KEY: str({ default: '' }),
  S3_BUCKET_NAME: str({ default: '' }),
})

if (env.S3_ENABLED) {
  const required = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME']
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable when S3_ENABLED=true: ${key}`)
    }
  }
}

module.exports = env
