const { cleanEnv, str, port, url, num } = require('envalid')

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),
  PORT: port({ default: 3000 }),
  MONGO_URI: url(),
  JWT_SECRET: str({ minLength: 32 }),
  JWT_REFRESH_SECRET: str({ minLength: 32 }),
  JWT_ACCESS_EXPIRES: str({ default: '15m' }),
  JWT_REFRESH_EXPIRES: str({ default: '7d' }),
  ALLOWED_ORIGINS: str({ default: 'http://localhost:3000' }),
  LOG_LEVEL: str({
    choices: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  }),
  MAX_FILE_SIZE: num({ default: 5242880 }), // 5MB
})

module.exports = env
