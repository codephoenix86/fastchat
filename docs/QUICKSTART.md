# Quick Start Guide

Get fastchat running locally in about 10 minutes.

---

## Prerequisites

| Requirement | Version  |
| ----------- | -------- |
| Node.js     | ≥ 18.0.0 |
| npm         | ≥ 9.0.0  |
| MongoDB     | ≥ 6.0    |
| PostgreSQL  | ≥ 16     |
| Redis       | ≥ 7.2    |

All three databases must be reachable before the server will start. The app exits immediately at startup if any connection fails or a required environment variable is missing.

AWS S3 is **optional** (gated by `S3_ENABLED=true`). Avatar endpoints are simply unavailable when S3 is disabled — the rest of the API works normally.

---

## 1. Clone and Install

```bash
git clone https://github.com/codephoenix86/fastchat.git
cd fastchat
npm install
```

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
NODE_ENV=development
PORT=3000

# Databases
MONGODB_URI=mongodb://localhost:27017/fastchat
POSTGRES_URI=postgresql://postgres:password@localhost:5432/fastchat
REDIS_URI=redis://localhost:6379

# JWT — must be at least 32 characters
ACCESS_TOKEN_SECRET=replace_with_a_long_random_secret_here
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

# CORS (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:3000

# Avatar storage (optional)
S3_ENABLED=false
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# S3_BUCKET_NAME=...
```

Generate a secure JWT secret in one command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### AWS S3 Setup (optional)

To enable avatar uploads, set `S3_ENABLED=true` and provide all four AWS variables. The IAM user needs only these two S3 permissions on your bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

---

## 3. Start the Databases

### Option A — Docker (recommended for local dev)

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

### Option B — Docker Compose (infrastructure only)

Spin up just the databases from the provided `compose.yml`:

```bash
docker compose up mongodb postgres redis -d
```

> The Compose file is configured for the full stack including the app image. To use it for local dev with a local `node` process, start only the database services as shown above.

### Option C — System services

```bash
# macOS (Homebrew)
brew services start mongodb-community postgresql redis

# Ubuntu / Debian
sudo systemctl start mongod postgresql redis-server
```

---

## 4. Run PostgreSQL Migrations

fastchat uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) to manage the PostgreSQL schema. Run this once before starting the server for the first time, and again after pulling changes that include new migrations:

```bash
npm run migrate:up
```

This creates the `pgcrypto` extension, the `user_role` enum, and the `users` and `profiles` tables.

---

## 5. Create the Logs Directory

```bash
mkdir -p logs
```

Winston writes rotating log files here. The directory must exist before the server starts.

---

## 6. Start the Server

```bash
# Development — auto-reloads on file changes
npm run dev

# Production
npm start
```

A successful startup prints:

```
info: All databases connected
info: Socket.io server initialized
info: Server listening on port 3000
```

If any database is unreachable, the process exits with a connection error message identifying which one failed.

---

## 7. Verify with a Health Check

```bash
curl http://localhost:3000/health
```

Expected response (`status: "OK"` means all databases are reachable):

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

If `status` is `"DEGRADED"`, check the `checks` object to identify which database is unreachable.

---

## 8. Try the API

### Register a user

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "email": "alice@example.com", "password": "Password@123"}'
```

### Log in and capture tokens

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "Password@123"}'
```

Save the `accessToken` and `refreshToken` from the response.

### Fetch your profile

```bash
curl -s http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## Deployment with Docker

The repository includes a multi-stage `Dockerfile` that produces a minimal production image:

```bash
docker build -t fastchat .
docker run -p 3000:3000 --env-file .env fastchat
```

Or pull the published image:

```bash
docker pull nareshlohar86/fastchat
docker run -p 3000:3000 --env-file .env nareshlohar86/fastchat
```

For production, run migrations against your production database before starting the container:

```bash
POSTGRES_URI=<prod-uri> npm run migrate:up
```

---

## Common Issues

### `connect ECONNREFUSED` for any database

The relevant database is not running. Check with:

```bash
docker ps                                        # if using containers
sudo systemctl status mongod postgresql redis-server  # if using system services
```

### `ACCESS_TOKEN_SECRET must be at least 32 characters`

Your secret in `.env` is too short. Generate a proper one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `Invalid environment variables`

The startup env validator (`envalid`) rejected one or more variables. The error message lists which ones. Check spelling and that required values are not empty.

### `relation "users" does not exist`

Migrations have not been run against this database. Execute:

```bash
npm run migrate:up
```

### Port 3000 already in use

```bash
# Find and kill the process
kill -9 $(lsof -ti:3000)

# Or change the port
PORT=3001 npm run dev
```

### Avatar upload returns 500

Verify that:

- `S3_ENABLED=true` is set in `.env`
- All four AWS variables (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`) are present and correct
- The IAM user has `s3:PutObject` and `s3:DeleteObject` on the bucket
- `AWS_REGION` matches the bucket's actual region

---

## Next Steps

- [REST API Reference](API_REST.md) — full endpoint catalogue with request/response shapes
- [WebSocket API Reference](API_WEBSOCKET.md) — Socket.io connection guide and event reference
- [Architecture Overview](ARCHITECTURE.md) — how the layers, databases, and patterns fit together
- [Testing Guide](TESTING.md) — run and write tests
