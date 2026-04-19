const path = require('path')
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const env = require('./env')

// Serialize Error objects into a plain { message, name, stack, code } structure.
const serializeError = winston.format((info) => {
  if (info.err instanceof Error) {
    info.err = {
      message: info.err.message,
      name: info.err.name,
      stack: info.err.stack,
      ...(info.err.code && { code: info.err.code }),
    }
  }
  return info
})

// Production format: newline-delimited JSON, one log entry per line.
// Includes ISO 8601 UTC timestamp so entries are unambiguous across timezones.
const jsonFormat = winston.format.combine(
  serializeError(),
  winston.format.timestamp({ format: () => new Date().toISOString() }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Development format: human-readable, colorized, with full metadata on one line.
const devFormat = winston.format.combine(
  serializeError(),
  winston.format.timestamp({ format: () => new Date().toISOString() }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ level: true }),
  winston.format.printf(({ level, message, timestamp, service: _s, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${metaStr}`
  })
)

const rotateOptions = {
  datePattern: 'YYYY-MM-DD',
  maxSize: env.LOG_FILE_MAX_SIZE,
  maxFiles: env.LOG_FILE_MAX_FILES,
  zippedArchive: true, // compress rotated files to save disk space
  format: jsonFormat,
}

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'fastchat-api' },
  transports: [
    // Error-only log: fast path for alerting and on-call triage.
    new DailyRotateFile({
      ...rotateOptions,
      filename: path.join(env.LOG_DIR, 'error-%DATE%.log'),
      level: 'error',
    }),
    // Combined log: full audit trail at configured level.
    new DailyRotateFile({
      ...rotateOptions,
      filename: path.join(env.LOG_DIR, 'combined-%DATE%.log'),
    }),
  ],
  // Prevent Winston from exiting on uncaught logger exceptions.
  exitOnError: false,
})

if (env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: devFormat }))
}

module.exports = logger
