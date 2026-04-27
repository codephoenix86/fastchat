# fastchat

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-5.x-lightgrey)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-green)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D16-blue)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%3E%3D7.2-red)](https://redis.io/)
[![Socket.io](https://img.shields.io/badge/socket.io-4.x-black)](https://socket.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A production-ready real-time chat API built with Node.js, Express 5, Socket.io, PostgreSQL, MongoDB, and Redis. Implements clean layered architecture with JWT authentication, token rotation, online presence tracking, delivery receipts, and optional AWS S3 avatar storage.

**Live API:** `https://fastchat.duckdns.org` — verify with `GET /health`

---

## Features

| Capability                   | Details                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| **Authentication**           | JWT access tokens (15 min) + opaque refresh tokens (7 days) in Redis with full rotation       |
| **User management**          | PostgreSQL-backed users and profiles — CRUD, password change, account deletion                |
| **Avatar storage**           | Upload/delete to AWS S3 via multipart form-data (optional, gated by `S3_ENABLED`)             |
| **Private & group chats**    | Create, update, delete chats; full member management with admin roles                         |
| **Real-time messaging**      | Send via REST, receive via Socket.io with `message:new` broadcast                             |
| **Delivery & read receipts** | `message:delivered` / `message:read` socket events update MongoDB status                      |
| **Typing indicators**        | `message:start-typing` / `message:stop-typing` broadcast to room participants                 |
| **Online presence**          | Redis Set per user; first-connect / last-disconnect broadcasts `user:online` / `user:offline` |
| **Pagination**               | All list endpoints support `?page`, `limit`, `sort`, `search`, `role`, `type`                 |
| **Security**                 | Helmet, CORS, XSS sanitization, Joi validation, Redis-backed rate limiting                    |
| **Logging**                  | Winston with daily log rotation; structured JSON in production                                |

---

## Quick Start

```bash
git clone https://github.com/codephoenix86/fastchat.git
cd fastchat
npm install

cp .env.example .env   # Fill in DB URIs and secrets

npm run migrate:up     # Apply PostgreSQL schema migrations

npm run dev            # Start development server (auto-reload)
```

Then verify all databases are reachable:

```bash
curl http://localhost:3000/health
```

Full setup walkthrough → **[Quick Start Guide](docs/QUICKSTART.md)**

---

## Tech Stack

| Layer               | Technology                              |
| ------------------- | --------------------------------------- |
| Runtime / Framework | Node.js ≥ 18, Express 5.x               |
| Users & Auth        | PostgreSQL 16+ via `pg` (node-postgres) |
| Chats & Messages    | MongoDB 6.0+ via Mongoose               |
| Sessions & Presence | Redis 7.2+ via ioredis                  |
| Real-time           | Socket.io 4.x                           |
| File Storage        | AWS S3 via `@aws-sdk/client-s3`         |
| Validation          | Joi                                     |
| Logging             | Winston + `winston-daily-rotate-file`   |
| Testing             | Jest 30 + Supertest 7                   |

---

## Project Structure

```
fastchat/
├── server.js               # Entry point — DB init, HTTP + Socket.io server
├── src/
│   ├── app.js              # Express app factory — middleware stack, route mounting
│   ├── config/             # DB clients (mongo, postgres, redis, s3), logger, env
│   ├── constants/          # Shared enums: CHAT_TYPES, MESSAGE_STATUS, SOCKET_EVENTS
│   ├── controllers/        # Thin handlers: validate → service → ApiResponse
│   ├── errors/             # Custom error class hierarchy (AppError subclasses)
│   ├── middlewares/        # Auth, validation, upload, sanitization, rate limiting
│   ├── models/             # Mongoose schemas: Chat, Message
│   ├── repositories/       # Data-access layer — one class per DB concern
│   ├── routes/             # Express router definitions (no business logic)
│   ├── schemas/            # Joi validation schemas (per domain)
│   ├── services/           # All business logic
│   ├── sockets/            # Socket.io init, auth middleware, event handlers
│   └── utils/              # asyncHandler, ApiResponse, pagination helpers
├── migrations/             # node-pg-migrate PostgreSQL migrations
├── tests/
│   ├── integration/        # Supertest API tests against real databases
│   ├── unit/               # Isolated tests with mocked dependencies
│   ├── helpers/            # DB lifecycle and assertion helpers
│   ├── factories/          # Test data factories
│   └── setup.js            # Global mocks: logger, Socket.io, S3
├── docs/                   # Documentation
└── logs/                   # Rotated log files (created at runtime)
```

---

## API Overview

```
GET  /health

POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh

GET    /api/v1/users
GET    /api/v1/users/:userId
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

Full reference → **[REST API Reference](docs/API_REST.md)**

---

## Scripts

```bash
npm start                         # Production server
npm run dev                       # Development with nodemon (auto-reload)

npm test                          # Full suite with coverage (serial — reliable)
npm run test:parallel             # Full suite (parallel workers — faster, may flake on integration)
npm run test:unit                 # Unit tests only
npm run test:integration          # Integration tests only (serial)
npm run test:watch                # Watch mode
npm run test:debug                # Attach Node inspector

npm run migrate:up                # Apply pending PostgreSQL migrations
npm run migrate:down              # Roll back the last migration
npm run migrate:create -- <name>  # Create a new migration file

npm run lint                      # Lint all source files
npm run lint:fix                  # Lint and auto-fix
npm run format                    # Format with Prettier
npm run format:check              # Check formatting without writing
```

---

## Documentation

| Document                                         | Description                                         |
| ------------------------------------------------ | --------------------------------------------------- |
| [Quick Start Guide](docs/QUICKSTART.md)          | Local setup from clone to running server            |
| [Architecture Overview](docs/ARCHITECTURE.md)    | System design, data flow, DB schemas, patterns      |
| [Deployment Guide](docs/DEPLOYMENT.md)           | AWS EC2 setup, Docker, Nginx, SSL, common mistakes  |
| [REST API Reference](docs/API_REST.md)           | All HTTP endpoints with request/response shapes     |
| [WebSocket API Reference](docs/API_WEBSOCKET.md) | Socket.io events, presence, and client example      |
| [Testing Guide](docs/TESTING.md)                 | Test strategy, environment setup, helpers, patterns |

---

## Infrastructure

fastchat is deployed in two environments:

### Render (always-on, free tier)

**Live API:** `https://fastchat-u3tn.onrender.com` — verify with `GET /health`

| Component  | Technology                   |
| ---------- | ---------------------------- |
| Server     | Render (Docker deployment)   |
| Database   | Neon (PostgreSQL, free tier) |
| Cache      | Upstash (Redis, free tier)   |
| MongoDB    | MongoDB Atlas (free tier)    |
| Containers | Docker                       |

### AWS EC2 (kept offline to avoid charges)

The EC2 deployment uses a self-managed stack on a t3.micro instance. It is spun up occasionally and may not be live at any given time.

> `https://fastchat.duckdns.org` — may be offline to avoid AWS charges

| Component      | Technology                            |
| -------------- | ------------------------------------- |
| Server         | AWS EC2 (t3.micro, Ubuntu)            |
| Reverse proxy  | Nginx (Docker container)              |
| TLS            | Let's Encrypt via Certbot             |
| Domain         | DuckDNS (`fastchat.duckdns.org`)      |
| Containers     | Docker + Docker Compose               |
| Image registry | Docker Hub (`nareshlohar86/fastchat`) |

Full deployment writeup → **[Production Deployment](docs/DEPLOYMENT.md)**

Behind-the-scenes story → **[How I Deployed My First Production App on AWS EC2 — Every Mistake I Made](https://dev.to/codephoenix86/how-i-deployed-my-first-production-app-on-aws-ec2-every-mistake-i-made-4e8e)**

---

## License

ISC — [Naresh Lohar](https://github.com/codephoenix86/fastchat)
