# Quick Start Guide

Get fastchat running on your local machine in about 10 minutes.

## Prerequisites

| Requirement | Version   |
| ----------- | --------- |
| Node.js     | >= 18.0.0 |
| npm         | >= 9.0.0  |
| MongoDB     | >= 6.0    |
| PostgreSQL  | >= 16     |
| Redis       | >= 7.2    |

All three databases must be running before the server will start.

---

## Step 1: Clone and Install

```bash
git clone https://github.com/codephoenix86/fastchat.git
cd fastchat
npm install
```

---

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
NODE_ENV=development
PORT=3000

# MongoDB — stores chats and messages
MONGODB_URI=mongodb://localhost:27017/fastchat

# PostgreSQL — stores users and profiles
POSTGRES_URI=postgresql://postgres:password@localhost:5432/fastchat

# Redis — stores refresh tokens and online presence
REDIS_URI=redis://localhost:6379

# JWT secrets — must each be at least 32 characters
ACCESS_TOKEN_SECRET=your_very_long_secret_at_least_32_characters_here

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
```

Generate secure secrets in one command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice to get two different secrets.

---

## Step 3: Start the Databases

### Using Docker (recommended)

```bash
# MongoDB
docker run -d -p 27017:27017 --name fastchat-mongo mongo:6

# PostgreSQL
docker run -d -p 5432:5432 --name fastchat-pg \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=fastchat \
  postgres:16-alpine

# Redis
docker run -d -p 6379:6379 --name fastchat-redis redis:7.2-alpine
```

Or use the provided `compose.yml` (requires a built image):

```bash
docker compose up mongodb postgres redis -d
```

### Using system services

```bash
# macOS (Homebrew)
brew services start mongodb-community
brew services start postgresql
brew services start redis

# Ubuntu / Debian
sudo systemctl start mongod postgresql redis-server
```

---

## Step 4: Create Required Directories

```bash
mkdir -p logs uploads/public/avatars uploads/private
```

---

## Step 5: Run PostgreSQL Migrations

fastchat uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) to manage the PostgreSQL schema. You must run migrations before starting the server for the first time.

```bash
npm run migrate:up
```

This creates the `users` and `profiles` tables (and the `pgcrypto` extension needed for UUID generation).

---

## Step 6: Start the Server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

A successful startup looks like:

```
info: All databases connected
info: Socket.io server initialized
info: Server listening on port 3000
```

If any database connection fails, the process exits immediately with a logged error.

---

## Step 7: Verify with a Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "uptime": 5.12,
  "timestamp": 1706000000000,
  "status": "OK",
  "environment": "development",
  "version": "1.0.0",
  "checks": {
    "mongodb": "connected",
    "postgresql": "connected",
    "redis": "connected"
  }
}
```

If `status` is `DEGRADED`, check the `checks` object to see which database is unreachable.

---

## Step 8: Try the API

### Create a user

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "Password@123"
  }'
```

### Log in

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "Password@123"}'
```

Save the `accessToken` and `refreshToken` from the response.

### Get your profile

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## Next Steps

- **[REST API Reference](API_REST.md)** — full endpoint catalogue
- **[WebSocket API](API_WEBSOCKET.md)** — real-time connection guide
- **[Architecture Overview](ARCHITECTURE.md)** — understand how the three databases are used

---

## Common Issues

### `connect ECONNREFUSED` for any database

The relevant database is not running. Start it and retry.

```bash
# Check running containers
docker ps

# Or check system services
sudo systemctl status mongod postgresql redis-server
```

### `ACCESS_TOKEN_SECRET must be at least 32 characters long`

Your `.env` secret is too short. Generate a proper one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Port 3000 already in use

```bash
# Find the process
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or change the port in .env
PORT=3001
```

### PostgreSQL `relation "users" does not exist`

Migrations have not been run. Execute `npm run migrate:up`.

### `relation already exists` on `migrate:up`

The migration was already applied. This is safe to ignore; node-pg-migrate tracks which migrations have run.
