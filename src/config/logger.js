const path = require('path')
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const env = require('./env')

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'fastchat-api' },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: path.join(env.LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: env.LOG_FILE_MAX_SIZE,
      maxFiles: env.LOG_FILE_MAX_FILES,
    }),
    // Combined logs
    new DailyRotateFile({
      filename: path.join(env.LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: env.LOG_FILE_MAX_SIZE,
      maxFiles: env.LOG_FILE_MAX_FILES,
    }),
  ],
})

// Console logging in development
if (env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  )
}

module.exports = logger
