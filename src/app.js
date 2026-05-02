const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const crypto = require('crypto')
const onFinished = require('on-finished')
const app = express()

app.set('trust proxy', true)
app.set('trust proxy', 1)

const routes = require('@routes')
const { handleError, sanitize } = require('@middlewares')
const { logger, env } = require('@config')

// Security middleware
app.use(helmet())

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',') || []

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))

// Request parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Assign a unique ID to every request for end-to-end traceability.
app.use((req, res, next) => {
  req.id = crypto.randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
})

// Sanitize user input
app.use(sanitize)

// Log one entry per request on response finish so we capture status + duration.
// Health checks are excluded to avoid polluting logs with high-frequency noise.
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next()
  }

  const startedAt = process.hrtime.bigint()

  onFinished(res, () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    let level
    if (res.statusCode >= 500) {
      level = 'error'
    } else if (res.statusCode >= 400) {
      level = 'warn'
    } else {
      level = 'info'
    }
    logger[level]('HTTP request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
      requestId: req.id,
      userId: req.user?.id,
    })
  })

  next()
})

// API documentation page
app.get('/', (req, res) => {
  res.redirect(301, 'https://naresh-api-docs.vercel.app')
})

// All routes
app.use(routes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    status: 404,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  })
})

// Global error handler (must be last)
app.use(handleError)

module.exports = app
