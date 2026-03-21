# fastchat — Real-Time Chat Application

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-green)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D16-blue)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%3E%3D7.2-red)](https://redis.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A production-ready real-time chat application built with Node.js, Express, MongoDB, PostgreSQL, Redis, and Socket.io — following REST best practices and clean architecture principles.

## Live Demo

The API is deployed on AWS EC2 with HTTPS, Nginx reverse proxy, and Docker.

**Base URL:** https://fastchat.duckdns.org

> **Note:** This URL may not always be live. Check the health endpoint to verify: `GET https://fastchat.duckdns.org/health`

**Deployment write-up:** [How I Deployed My First Production App on AWS EC2 — Every Mistake I Made](https://dev.to/codephoenix86/how-i-deployed-my-first-production-app-on-aws-ec2-every-mistake-i-made-4e8e)

## Features

- 🔐 **JWT Authentication** — Short-lived access tokens with opaque refresh tokens stored in Redis
- 👥 **User Management** — PostgreSQL-backed users and profiles with full CRUD support
- 💬 **Real-Time Messaging** — Instant messaging with delivery/read receipts via Socket.io
- 🔔 **Typing Indicators** — Real-time typing status broadcasts
- 👤 **Avatar Support** — Profile pictures stored in AWS S3 via multipart file upload
- 🔍 **Advanced Queries** — Pagination, search, filtering, and sorting on all list endpoints
- 📊 **Online Presence** — Redis-backed user presence tracking with last-seen timestamps
- 🔒 **Security** — Helmet, CORS, XSS sanitization, input validation, and rate limiting
- 📝 **Structured Logging** — Winston with daily log rotation
- ✅ **Full Test Coverage** — Unit and integration tests with 70%+ coverage threshold

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URIs, secrets, and AWS credentials

# Run PostgreSQL migrations
npm run migrate:up

# Start development server
npm run dev

# Run tests
npm test
```

## Documentation

- **[Quick Start Guide](docs/QUICKSTART.md)** — Get up and running in 5 minutes
- **[REST API Reference](docs/API_REST.md)** — Complete HTTP endpoint documentation
- **[WebSocket API](docs/API_WEBSOCKET.md)** — Socket.io events and real-time features
- **[Architecture Overview](docs/ARCHITECTURE.md)** — System design and patterns
- **[Testing Guide](docs/TESTING.md)** — Testing strategy and best practices

## Tech Stack

| Layer               | Technology                             |
| ------------------- | -------------------------------------- |
| Runtime             | Node.js 18+, Express 5.x               |
| Users / Auth        | PostgreSQL 16+ (via `pg`)              |
| Chats / Messages    | MongoDB 6.0+ (via Mongoose)            |
| Sessions / Presence | Redis 7.2+ (via ioredis)               |
| Real-time           | Socket.io 4.x                          |
| Authentication      | JWT (access) + opaque tokens (refresh) |
| File Storage        | AWS S3 (via `@aws-sdk/client-s3`)      |
| Validation          | Joi schemas                            |
| Testing             | Jest, Supertest                        |
| Logging             | Winston + daily-rotate-file            |

## Infrastructure

| Component      | Technology                         |
| -------------- | ---------------------------------- |
| Server         | AWS EC2 (t3.micro, Ubuntu)         |
| Reverse Proxy  | Nginx (Docker container)           |
| SSL            | Let's Encrypt via Certbot          |
| Domain         | DuckDNS (fastchat.duckdns.org)     |
| Containers     | Docker + Docker Compose            |
| Image Registry | DockerHub (nareshlohar86/fastchat) |

## Environment Configuration

| Variable                | Description                                | Default                 |
| ----------------------- | ------------------------------------------ | ----------------------- |
| `NODE_ENV`              | Environment mode                           | `development`           |
| `PORT`                  | Server port                                | `3000`                  |
| `MONGODB_URI`           | MongoDB connection string                  | Required                |
| `POSTGRES_URI`          | PostgreSQL connection string               | Required                |
| `REDIS_URI`             | Redis connection string                    | Required                |
| `ACCESS_TOKEN_SECRET`   | Access token signing secret (min 32 chars) | Required                |
| `ACCESS_TOKEN_TTL`      | Access token lifetime                      | `15m`                   |
| `REFRESH_TOKEN_TTL`     | Refresh token Redis key TTL                | `7d`                    |
| `ALLOWED_ORIGINS`       | Comma-separated CORS origins               | `http://localhost:3000` |
| `MAX_FILE_SIZE`         | Avatar upload limit in bytes               | `5242880`               |
| `AWS_REGION`            | AWS region for S3                          | Required                |
| `AWS_ACCESS_KEY_ID`     | AWS IAM access key ID                      | Required                |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key                  | Required                |
| `S3_BUCKET_NAME`        | S3 bucket name for avatar storage          | Required                |

See [.env.example](.env.example) for the full template.

## API Overview

```
GET  /health

POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh

GET    /api/v1/users
GET    /api/v1/users/:id
GET    /api/v1/users/me
PATCH  /api/v1/users/me
DELETE /api/v1/users/me
POST   /api/v1/users/me/avatar
DELETE /api/v1/users/me/avatar
PATCH  /api/v1/users/me/password

GET    /api/v1/chats
POST   /api/v1/chats
GET    /api/v1/chats/:chatId
PATCH  /api/v1/chats/:chatId
DELETE /api/v1/chats/:chatId
GET    /api/v1/chats/:chatId/members
POST   /api/v1/chats/:chatId/members/:userId
DELETE /api/v1/chats/:chatId/members/me
DELETE /api/v1/chats/:chatId/members/:userId

GET    /api/v1/chats/:chatId/messages
POST   /api/v1/chats/:chatId/messages
GET    /api/v1/chats/:chatId/messages/:messageId
PATCH  /api/v1/chats/:chatId/messages/:messageId
DELETE /api/v1/chats/:chatId/messages/:messageId
```

See [REST API Reference](docs/API_REST.md) for full documentation.

## Scripts

```bash
npm start                        # Production server
npm run dev                      # Development with nodemon
npm test                         # All tests with coverage
npm run test:watch               # Watch mode
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests only
npm run test:sequential          # Run tests serially (debug)
npm run migrate:up               # Apply PostgreSQL migrations
npm run migrate:down             # Roll back last migration
npm run migrate:create -- <name> # Create a new migration file
npm run lint                     # Lint source files
npm run format                   # Format with Prettier
```

## Project Structure

```
fastchat/
├── src/
│   ├── config/          # DB connections (mongo, postgres, redis, s3), logger, env
│   ├── constants/       # Shared enums and validation constants
│   ├── controllers/     # Express route handlers
│   ├── errors/          # Custom error classes
│   ├── middlewares/     # Auth, validation, upload, sanitization, rate-limit
│   ├── models/          # Mongoose schemas (Chat, Message)
│   ├── repositories/    # Data-access layer (mongo + postgres + redis)
│   ├── routes/          # Express router definitions
│   ├── schemas/         # Joi validation schemas
│   ├── services/        # Business logic
│   ├── sockets/         # Socket.io server, handlers, middleware
│   ├── utils/           # asyncHandler, JWT helpers, pagination, ApiResponse
│   └── app.js           # Express app setup
├── migrations/          # node-pg-migrate PostgreSQL migrations
├── tests/
│   ├── integration/     # Supertest API tests
│   ├── unit/            # Isolated service / middleware tests
│   ├── helpers/         # DB connect/clear/disconnect helpers
│   └── setup.js         # Jest global setup
├── logs/                # Rotated application logs
├── docs/                # Documentation
└── server.js            # Entry point
```

## License

ISC

## Author

Naresh Lohar — [GitHub](https://github.com/codephoenix86/fastchat) · [LinkedIn](https://www.linkedin.com/in/nareshlohar86/)
