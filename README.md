# fastchat - Real-Time Chat Application

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-green)](https://www.mongodb.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A production-ready real-time chat application built with Node.js, Express, MongoDB, and Socket.io following REST best practices and clean architecture principles.

## Features

- 🔐 **JWT Authentication** - Access/refresh token system with automatic rotation
- 👥 **User Management** - Complete CRUD operations with profile customization
- 💬 **Real-Time Messaging** - Instant messaging with delivery/read receipts
- 🔔 **Typing Indicators** - Real-time typing status updates
- 👤 **Avatar Support** - User profile pictures with file upload
- 🔍 **Advanced Queries** - Pagination, filtering, and sorting on all endpoints
- 📊 **Online Status** - Track user presence with last seen timestamps
- 🔒 **Security** - XSS protection, input sanitization, and security headers
- 📝 **Comprehensive Logging** - Structured logging with daily rotation
- ✅ **Full Test Coverage** - Unit and integration tests with 70%+ coverage

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Create required directories
mkdir -p logs uploads/public/avatars uploads/private

# Start development server
npm run dev

# Run tests
npm test
```

## Documentation

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- **[REST API Reference](docs/API_REST.md)** - Complete HTTP endpoint documentation
- **[WebSocket API](docs/API_WEBSOCKET.md)** - Socket.io events and real-time features
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and patterns
- **[Testing Guide](docs/TESTING.md)** - Testing strategy and best practices

## Tech Stack

**Backend:** Node.js 18+, Express 5.x  
**Database:** MongoDB 6.0+  
**Real-time:** Socket.io 4.x  
**Authentication:** JWT with bcrypt  
**Testing:** Jest with Supertest  
**Logging:** Winston with daily rotation

## Environment Configuration

| Variable             | Description                         | Default       |
| -------------------- | ----------------------------------- | ------------- |
| `NODE_ENV`           | Environment mode                    | `development` |
| `PORT`               | Server port                         | `3000`        |
| `MONGO_URI`          | MongoDB connection string           | Required      |
| `JWT_SECRET`         | JWT secret (min 32 chars)           | Required      |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | Required      |

See [.env.example](.env.example) for complete configuration.

## API Overview

```bash
# Health check
GET /health

# Authentication
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh

# Users
GET    /api/v1/users
GET    /api/v1/users/:id
GET    /api/v1/users/me
PATCH  /api/v1/users/me
DELETE /api/v1/users/me

# Chats
GET    /api/v1/chats
POST   /api/v1/chats
GET    /api/v1/chats/:chatId
PATCH  /api/v1/chats/:chatId
DELETE /api/v1/chats/:chatId

# Messages
GET    /api/v1/chats/:chatId/messages
POST   /api/v1/chats/:chatId/messages
GET    /api/v1/chats/:chatId/messages/:messageId
PATCH  /api/v1/chats/:chatId/messages/:messageId
DELETE /api/v1/chats/:chatId/messages/:messageId
```

See [REST API Reference](docs/API_REST.md) for detailed documentation.

## Scripts

```bash
npm start              # Production server
npm run dev            # Development with nodemon
npm test               # Run all tests with coverage
npm run test:watch     # Run tests in watch mode
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
```

## Project Structure

```
fastchat/
├── src/
│   ├── config/          # Configuration and setup
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Express middleware
│   ├── models/          # Mongoose schemas
│   ├── repositories/    # Data access layer
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── sockets/         # Socket.io implementation
│   ├── utils/           # Helper functions
│   ├── constants/       # App-wide constants and enums
│   ├── errors/          # Custom error classes and handling
│   └── app.js           # Express application setup
├── tests/               # Test suites
├── uploads/             # User-uploaded files
├── logs/                # Application logs
├── docs/                # Documentation
└── server.js            # Server entry point
```

## License

ISC

## Author

Naresh Lohar

## Repository

https://github.com/codephoenix86/fastchat

## Support

- 📖 [Documentation](docs/)
- 🐛 [Report Issues](https://github.com/codephoenix86/fastchat/issues)
