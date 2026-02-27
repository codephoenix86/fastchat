# Architecture Overview

System design, data flow, database schemas, and design patterns for fastchat.

---

## System Architecture

fastchat uses **three purpose-built databases** rather than a single store:

| Database       | Role                                                             |
| -------------- | ---------------------------------------------------------------- |
| **PostgreSQL** | Users, profiles, roles — relational, strongly typed, ACID        |
| **MongoDB**    | Chats and messages — flexible documents, easy horizontal scaling |
| **Redis**      | Refresh token sessions, online presence — in-memory, TTL-native  |

```
┌──────────┐        HTTP / WebSocket
│  Client  │◄──────────────────────────────────────────────┐
└──────────┘                                               │
                                                           │
                        ┌──────────────────────────────────┴──────┐
                        │           Express Application           │
                        │  Helmet · CORS · Body Parser · XSS      │
                        │  Request ID · Logger · Auth · Validate  │
                        └──────────────┬──────────────────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                     ▼
           ┌──────────┐        ┌──────────────┐      ┌──────────────┐
           │  Routes  │        │  Socket.io   │      │   Health     │
           │  /api    │        │   Server     │      │   /health    │
           └────┬─────┘        └──────┬───────┘      └──────────────┘
                │                     │
                ▼                     │
         ┌─────────────┐              │
         │ Controllers │              │
         └──────┬──────┘              │
                │                     │
                └──────────┬──────────┘
                           ▼
                  ┌─────────────────┐
                  │    Services     │
                  │ auth · user     │
                  │ chat · message  │
                  │ token · presence│
                  └────────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌─────────────┐  ┌─────────────┐
   │    User    │  │    Chat /   │  │    Token    │
   │ Repository │  │   Message   │  │ Repository  │
   │(PostgreSQL)│  │ Repository  │  │  (Redis)    │
   └─────┬──────┘  │ (MongoDB)   │  └──────┬──────┘
         │         └──────┬──────┘         │
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────────┐  ┌──────────┐
   │PostgreSQL│    │   MongoDB    │  │  Redis   │
   │ users    │    │ chats        │  │ rt:*     │
   │ profiles │    │ messages     │  │ online:* │
   └──────────┘    └──────────────┘  └──────────┘
```

---

## Request Flow

```
Client Request
      │
      ▼
┌─────────────────────────────────────────────┐
│              Middleware Chain               │
│  1. Helmet (security headers)               │
│  2. CORS (origin validation)                │
│  3. Body Parser (JSON / URL-encoded)        │
│  4. Request ID (crypto.randomUUID)          │
│  5. XSS Sanitization                        │
│  6. Request Logger                          │
│  7. JWT Verification (protected routes)     │
│  8. Joi Schema Validation                   │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│                Controller                  │
│  • Extracts validated fields from req       │
│  • Calls one service method                 │
│  • Wraps result in ApiResponse              │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│                 Service                    │
│  • Enforces business rules                  │
│  • Calls one or more repositories           │
│  • Throws typed AppError subclasses         │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│               Repository                   │
│  • Single database concern                  │
│  • Returns raw DB rows / documents          │
└─────────────────────────────────────────────┘
      │
      ▼
┌──────────┬──────────────┬─────────┐
│PostgreSQL│   MongoDB    │  Redis  │
└──────────┴──────────────┴─────────┘

Error path: any thrown AppError is caught by
asyncHandler and forwarded to the global error
middleware, which serialises it to JSON.
```

### Example: Sending a Message

1. `POST /api/v1/chats/:chatId/messages` enters the middleware chain.
2. Auth middleware verifies the JWT and attaches `req.user`.
3. Joi schema validates `{ content }` in the body and `:chatId` UUID in params.
4. `MessageController.sendMessage` calls `messageService.sendMessage(...)`.
5. Service fetches the chat from **MongoDB** to confirm it exists and the user is a participant.
6. Service creates the message document in **MongoDB**.
7. Controller emits `message:new` to the Socket.io room (`chatId`) so connected clients receive it in real-time.
8. Controller responds with the new message wrapped in `ApiResponse`.

---

## Socket.io Real-time Architecture

```
Client connects (JWT in auth handshake)
          │
          ▼
  Socket Auth Middleware
  • verify JWT
  • attach socket.userId
          │
          ▼
  Connection Handler
  • registerChatHandlers(io, socket)
  • registerMessageHandlers(io, socket)
  • registerTypingHandlers(io, socket)
  • presenceService.addSocket(userId, socketId)
    → if first connection: broadcast user:online
          │
          ▼
  Event Handlers active (chat:join/leave,
  message:delivered/read, typing start/stop)
          │
          ▼
  Disconnect Handler
  • presenceService.removeSocket(userId, socketId)
    → if last connection: broadcast user:offline
```

### Presence via Redis

The `PresenceService` stores each user's active socket IDs in a Redis Set:

```
online:<userId>  →  Set { "socket1", "socket2", … }
```

- `addSocket` — SADD the socketId; if `SCARD` is now 1 → first connection.
- `removeSocket` — SREM the socketId; if count was 1 → last connection.

This approach correctly handles users connected from multiple tabs or devices.

---

## Database Schemas

### PostgreSQL — Users & Profiles

Two tables, linked 1:1.

**users**

| Column          | Type          | Notes                   |
| --------------- | ------------- | ----------------------- |
| `id`            | `uuid`        | PK, `gen_random_uuid()` |
| `username`      | `varchar(20)` | unique, min length 3    |
| `email`         | `text`        | unique                  |
| `password_hash` | `text`        | bcrypt hash             |
| `role`          | `user_role`   | enum: `user`, `admin`   |
| `created_at`    | `timestamp`   | default `now()`         |
| `updated_at`    | `timestamp`   | default `now()`         |

**profiles** (one-to-one with users, CASCADE delete)

| Column                      | Type        | Notes                        |
| --------------------------- | ----------- | ---------------------------- |
| `id`                        | `uuid`      | PK                           |
| `user_id`                   | `uuid`      | FK → users, unique           |
| `avatar`                    | `text`      | nullable filename            |
| `bio`                       | `text`      | nullable, max 200 chars      |
| `last_seen`                 | `timestamp` | updated on socket disconnect |
| `created_at` / `updated_at` | `timestamp` | —                            |

A profile row is created automatically when a user signs up.

### MongoDB — Chats

```javascript
{
  _id: String,          // crypto.randomUUID()
  type: String,         // 'private' | 'group'
  groupName: String,    // required for groups
  groupPicture: String, // optional
  participants: [String], // array of user UUIDs (PostgreSQL IDs)
  admin: String,        // user UUID, required for groups
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: `{ participants, createdAt }`, `{ participants, type }`, `{ admin }`

Private chats must have exactly 2 participants. Group chats must have at least 2.

### MongoDB — Messages

```javascript
{
  _id: String,    // crypto.randomUUID()
  content: String,  // required for type 'text'
  status: String,   // 'sent' | 'delivered' | 'read'
  sender: String,   // user UUID
  chat: String,     // chat _id
  type: String,     // 'text' | 'file'
  file: {           // required for type 'file'
    url: String,
    filename: String,
    mimetype: String,
  },
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: `{ chat, createdAt }`, `{ sender, createdAt }`, `{ status, chat }`

### Redis — Refresh Tokens

```
Key:   rt:<opaqueToken>
Value: <userId>
TTL:   REFRESH_TOKEN_TTL (e.g. 7 days in seconds)
```

Stored as plain string KV pairs via `SET … EX`. On logout or rotation the key is deleted with `DEL`.

### Redis — Presence

```
Key:   online:<userId>
Value: Redis Set of active socketIds
TTL:   none (managed explicitly by connect/disconnect handlers)
```

---

## Design Patterns

### Repository Pattern

Each database concern is wrapped in a repository class that exposes a domain-oriented interface. Services never import DB clients directly.

```
UserRepository   → PostgreSQL pool queries
ChatRepository   → Mongoose Model methods
MessageRepository → Mongoose Model methods
TokenRepository  → ioredis client
```

### Service Layer

All business rules live in services. Controllers are intentionally thin — they extract request data, call one service method, and format the response.

### asyncHandler Wrapper

Every async route handler is wrapped so that thrown errors are forwarded to the global error middleware via `next(err)` rather than crashing the process.

### Custom Error Hierarchy

```
AppError (base, isOperational = true)
  ├── ValidationError      400  VALIDATION_FAILED
  ├── AuthenticationError  401  UNAUTHORIZED / INVALID_TOKEN / …
  ├── AuthorizationError   403  FORBIDDEN
  ├── NotFoundError        404  NOT_FOUND
  ├── ConflictError        409  CONFLICT
  ├── PayloadTooLargeError 413  PAYLOAD_TOO_LARGE
  ├── RateLimitError       429  TOO_MANY_REQUESTS
  └── UnsupportedMediaTypeError 415
```

Operational errors produce a structured JSON response with a `code` field. Non-operational errors (programming bugs) produce a generic `INTERNAL_SERVER_ERROR` in production.

### Singleton Services

`presenceService`, `tokenService`, and all repository instances are module-level singletons, exported as plain objects. The Socket.io server instance is exposed via a Proxy that throws if accessed before `init()` is called.

---

## Graceful Shutdown

`server.js` registers handlers for `SIGTERM` and `SIGINT`. On signal:

1. Closes the Socket.io server and HTTP server (stops accepting new connections).
2. Disconnects MongoDB, closes the PostgreSQL pool, and quits Redis.
3. Exits with code `0`.

A 10-second forced-exit timeout is set to handle hung connections.

---

## See Also

- [REST API Reference](API_REST.md)
- [WebSocket API](API_WEBSOCKET.md)
- [Testing Guide](TESTING.md)
- [Quick Start Guide](QUICKSTART.md)
