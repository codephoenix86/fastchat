# REST API Reference

Complete HTTP API documentation for fastchat.

**Base URL:** `http://localhost:3000` (development) · `https://fastchat.duckdns.org` (live)

---

## Response Format

All endpoints return JSON with a consistent envelope.

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Paginated list

```json
{
  "success": true,
  "message": "Items fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request data",
    "details": [{ "path": "body.email", "message": "\"email\" must be a valid email" }]
  },
  "timestamp": "2024-01-21T10:30:00.000Z",
  "requestId": "uuid"
}
```

---

## Authentication Scheme

fastchat uses a two-token scheme:

| Token             | Type                          | Lifetime              | Transport                                                         |
| ----------------- | ----------------------------- | --------------------- | ----------------------------------------------------------------- |
| **Access token**  | JWT (HS256)                   | 15 min (configurable) | `Authorization: Bearer <token>` header                            |
| **Refresh token** | opaque hex string (128 chars) | 7 days (configurable) | `refresh_token` field in `application/x-www-form-urlencoded` body |

Refresh tokens are stored in Redis and are rotated on every use — the old token is deleted and a new pair is issued atomically.

---

## Health Check

### `GET /health`

Verify server and database connectivity. No authentication required.

**Response `200`** — all databases healthy

```json
{
  "uptime": 123.4,
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

**Response `503`** — one or more databases unreachable; `status` is `"DEGRADED"` and the affected `checks` entry shows the error message.

---

## Auth

All auth endpoints are **rate-limited to 5 requests per 15 minutes per IP**.

### `POST /api/v1/auth/signup`

Register a new user account.

**Request body** `application/json`

| Field      | Type   | Rules                                                                                     |
| ---------- | ------ | ----------------------------------------------------------------------------------------- |
| `username` | string | 3–20 chars; must start with a letter; letters, digits, `_`, `.` only                      |
| `email`    | string | valid email format                                                                        |
| `password` | string | min 8 chars; requires at least one uppercase, one lowercase, one digit, one of `@$!%*?&#` |

**Response `201`**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user"
    }
  }
}
```

**Errors** — `400` validation failed · `409` email or username already taken

---

### `POST /api/v1/auth/login`

Authenticate and receive a token pair.

**Request body** `application/json`

Provide `username` **or** `email` (not both).

```json
{ "username": "alice", "password": "Password@123" }
```

```json
{ "email": "alice@example.com", "password": "Password@123" }
```

**Response `200`**

```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": { "id": "uuid", "username": "alice", "email": "alice@example.com", "role": "user" },
    "accessToken": "<jwt>",
    "refreshToken": "<opaque>"
  }
}
```

**Errors** — `400` validation failed · `401` invalid credentials (`INVALID_CREDENTIALS`)

---

### `POST /api/v1/auth/logout`

Revoke the refresh token. The access token expires naturally (it is not invalidated server-side).

**Request body** `application/x-www-form-urlencoded`

```
refresh_token=<opaque>
```

**Response `200`**

```json
{ "success": true, "message": "User logged out successfully" }
```

**Errors** — `400` missing token · `401` token not found or already revoked (`SESSION_NOT_FOUND`)

---

### `POST /api/v1/auth/refresh`

Rotate the token pair. The submitted refresh token is invalidated and a new pair is issued.

**Request body** `application/x-www-form-urlencoded`

```
refresh_token=<opaque>
```

**Response `200`**

```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "<new_jwt>",
    "refreshToken": "<new_opaque>"
  }
}
```

**Errors** — `400` missing token · `401` token not found or expired (`REFRESH_TOKEN_REVOKED`)

---

## Users

Protected routes require `Authorization: Bearer <accessToken>`.

### `GET /api/v1/users`

List all users. **No authentication required.**

**Query parameters**

| Param    | Description                                                                     | Default       |
| -------- | ------------------------------------------------------------------------------- | ------------- |
| `page`   | Page number                                                                     | `1`           |
| `limit`  | Items per page (max 100)                                                        | `20`          |
| `search` | Full-text search on `username` and `email`                                      | —             |
| `role`   | Filter by role (`user` \| `admin`)                                              | —             |
| `sort`   | Comma-separated fields; prefix `-` for descending (e.g. `-created_at,username`) | `-created_at` |

**Response `200`** — paginated array of user objects (no `password_hash`)

---

### `GET /api/v1/users/:userId`

Get a user by UUID. **No authentication required.**

**Errors** — `400` invalid UUID format · `404` user not found

---

### `GET /api/v1/users/me`

Get the currently authenticated user's full profile, including avatar URL, bio, and last seen timestamp.

**Response `200`**

```json
{
  "success": true,
  "message": "Current user details",
  "data": {
    "user": {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user",
      "avatar": "https://your-bucket.s3.us-east-1.amazonaws.com/uuid-1706000000000",
      "bio": "Hello!",
      "lastSeen": "2024-01-21T10:30:00.000Z",
      "createdAt": "2024-01-20T10:00:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

The `avatar` field is omitted from the response when no avatar has been uploaded.

**Errors** — `401` missing or invalid token

---

### `PATCH /api/v1/users/me`

Update profile fields. At least one field must be provided.

**Request body** `application/json`

| Field      | Type   | Rules                    |
| ---------- | ------ | ------------------------ |
| `username` | string | 3–20 chars, valid format |
| `bio`      | string | max 200 chars            |

**Response `200`** — updated user object

**Errors** — `400` validation failed or no fields provided · `409` username already taken

---

### `DELETE /api/v1/users/me`

Permanently delete the authenticated user's account. If an avatar is set, it is also deleted from S3 (S3 deletion failure is logged but does not block account deletion).

**Response `200`**

```json
{ "success": true, "message": "Account deleted successfully" }
```

---

### `POST /api/v1/users/me/avatar`

Upload a profile picture. Requires `S3_ENABLED=true`. Any existing avatar is deleted from S3 before the new one is stored. The stored value is the full S3 URL.

**Request** `multipart/form-data` — field name: `avatar`

Accepted MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`  
Max file size: 5 MB (configurable via `MAX_FILE_SIZE`)

**Response `200`**

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "user": {
      "id": "uuid",
      "avatar": "https://your-bucket.s3.us-east-1.amazonaws.com/uuid-1706000000000"
    }
  }
}
```

**Errors** — `400` no file provided · `413` file too large · `415` unsupported file type · `500` S3 upload failed

---

### `DELETE /api/v1/users/me/avatar`

Remove the current avatar. Deletes the file from S3 and clears the `profiles.avatar` column. Safe to call even when no avatar is set.

**Response `200`**

```json
{
  "success": true,
  "message": "Avatar removed successfully",
  "data": { "user": { "id": "uuid", "avatar": null } }
}
```

---

### `PATCH /api/v1/users/me/password`

Change the account password. The current password must be provided for verification.

**Request body** `application/json`

| Field             | Type   | Rules                                                                           |
| ----------------- | ------ | ------------------------------------------------------------------------------- |
| `currentPassword` | string | required                                                                        |
| `newPassword`     | string | min 8 chars; same complexity rules as signup; must differ from current password |

**Response `200`**

```json
{ "success": true, "message": "Password changed successfully" }
```

**Errors** — `400` validation failed · `401` current password incorrect (`INVALID_PASSWORD`)

---

## Chats

All chat endpoints require `Authorization: Bearer <accessToken>`.

### `GET /api/v1/chats`

Get the authenticated user's chats.

**Query parameters**

| Param   | Description                                | Default      |
| ------- | ------------------------------------------ | ------------ |
| `page`  | Page number                                | `1`          |
| `limit` | Items per page (max 100)                   | `20`         |
| `type`  | Filter by chat type (`private` \| `group`) | —            |
| `sort`  | e.g. `-createdAt`                          | `-createdAt` |

**Response `200`** — paginated array of chat objects

---

### `POST /api/v1/chats`

Create a new chat. The authenticated user is automatically added as a participant (and as admin for group chats).

**Private chat** — `participants` must contain exactly one other user ID.

```json
{
  "type": "private",
  "participants": ["<userId>"]
}
```

**Group chat** — `participants` must contain at least one other user ID. `groupName` is required.

```json
{
  "type": "group",
  "groupName": "Team Chat",
  "participants": ["<userId1>", "<userId2>"]
}
```

**Validation rules**

- All participant IDs must be valid UUIDs and exist in the database
- Duplicate participant IDs are rejected
- `groupName` is required for group chats and must be absent for private chats

**Response `201`**

```json
{
  "success": true,
  "message": "Chat created successfully",
  "data": {
    "chat": {
      "id": "<chatId>",
      "type": "group",
      "name": "Team Chat",
      "admin": "<creatorId>",
      "participants": ["<userId1>", "<userId2>", "<creatorId>"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

**Errors** — `400` validation failed

---

### `GET /api/v1/chats/:chatId`

Get a single chat by ID. The requesting user must be a participant.

**Errors** — `403` not a participant · `404` chat not found

---

### `PATCH /api/v1/chats/:chatId`

Update a group chat. **Admin only.** Provide at least one field.

**Request body** `application/json`

| Field       | Type          | Notes                                                            |
| ----------- | ------------- | ---------------------------------------------------------------- |
| `groupName` | string        | 1–50 chars                                                       |
| `admin`     | string (UUID) | Must be an existing participant — use this to transfer ownership |

**Errors** — `400` private chat or no fields provided · `403` not admin · `404` chat not found

---

### `DELETE /api/v1/chats/:chatId`

Delete a group chat. **Admin only.**

**Errors** — `400` private chat · `403` not admin · `404` chat not found

---

### `GET /api/v1/chats/:chatId/members`

Get the full member list. The requesting user must be a participant.

**Response `200`**

```json
{
  "success": true,
  "message": "Members fetched successfully",
  "data": {
    "members": [
      { "id": "uuid", "username": "alice", "email": "...", "avatar": "...", "bio": "..." }
    ]
  }
}
```

---

### `POST /api/v1/chats/:chatId/members/:userId`

Add a member to a group chat. **Admin only.**

**Errors** — `400` private chat · `403` not admin · `404` user not found · `409` user already a member

---

### `DELETE /api/v1/chats/:chatId/members/me`

Leave a group chat (self-remove).

If the admin attempts to leave while other members remain, they must first transfer ownership via `PATCH /api/v1/chats/:chatId` (setting a new `admin`). The chat is deleted automatically when the last member leaves.

**Errors** — `400` private chat · `409` admin must transfer ownership before leaving (`ADMIN_TRANSFER_REQUIRED`)

---

### `DELETE /api/v1/chats/:chatId/members/:userId`

Remove a specific member from a group chat. **Admin only.** The auto-delete rule applies — the chat is deleted if the last member is removed.

**Errors** — `400` private chat · `403` not admin · `404` user not found

---

## Messages

All message endpoints require `Authorization: Bearer <accessToken>`.  
**Rate-limited to 100 requests per 15 minutes per IP.**

### `POST /api/v1/chats/:chatId/messages`

Send a message. A `message:new` Socket.io event is broadcast to all sockets in the chat room immediately after persistence.

**Request body** `application/json`

```json
{ "content": "Hello, world!" }
```

`content` must be a non-empty string, max 5000 characters.

**Response `201`**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "<messageId>",
      "content": "Hello, world!",
      "sender": "<userId>",
      "chat": "<chatId>",
      "status": "sent",
      "type": "text",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

**Errors** — `400` validation failed · `403` not a participant · `404` chat not found

---

### `GET /api/v1/chats/:chatId/messages`

Fetch paginated messages for a chat. Default sort is oldest-first (`createdAt` ascending).

**Query parameters** — `page`, `limit` (max 100, default 50), `sort`

**Errors** — `403` not a participant · `404` chat not found

---

### `GET /api/v1/chats/:chatId/messages/:messageId`

Fetch a single message. The requesting user must be a chat participant.

**Errors** — `403` not a participant · `404` message or chat not found

---

### `PATCH /api/v1/chats/:chatId/messages/:messageId`

Edit a message. **Sender only.** A `message:updated` Socket.io event is broadcast to the chat room.

**Request body** `application/json`

```json
{ "content": "Edited content here" }
```

**Errors** — `403` not the original sender (`NOT_MESSAGE_OWNER`) · `404` message not found

---

### `DELETE /api/v1/chats/:chatId/messages/:messageId`

Delete a message. **Sender only.** A `message:deleted` Socket.io event is broadcast to the chat room.

**Errors** — `403` not the original sender (`NOT_MESSAGE_OWNER`) · `404` message not found

---

## Error Code Reference

| Code                      | HTTP | Description                                   |
| ------------------------- | ---- | --------------------------------------------- |
| `VALIDATION_FAILED`       | 400  | Joi schema validation failed                  |
| `BAD_REQUEST`             | 400  | General bad request                           |
| `MISSING_TOKEN`           | 401  | Authorization header or refresh_token absent  |
| `INVALID_TOKEN`           | 401  | Token malformed or signature invalid          |
| `TOKEN_EXPIRED`           | 401  | Access token has expired                      |
| `TOKEN_NOT_ACTIVE`        | 401  | Token `nbf` not yet reached                   |
| `INVALID_CREDENTIALS`     | 401  | Wrong username/email or password              |
| `INVALID_PASSWORD`        | 401  | Incorrect current password on password change |
| `SESSION_NOT_FOUND`       | 401  | Refresh token not found in Redis (logout)     |
| `REFRESH_TOKEN_REVOKED`   | 401  | Refresh token deleted or expired (refresh)    |
| `FORBIDDEN`               | 403  | Action not permitted                          |
| `NOT_A_MEMBER`            | 403  | User is not a chat participant                |
| `ADMIN_REQUIRED`          | 403  | Only the group admin may perform this action  |
| `NOT_MESSAGE_OWNER`       | 403  | Only the original sender may edit/delete      |
| `NOT_FOUND`               | 404  | Resource does not exist                       |
| `EMAIL_ALREADY_EXISTS`    | 409  | Duplicate email on signup                     |
| `USERNAME_ALREADY_TAKEN`  | 409  | Duplicate username on signup or update        |
| `ALREADY_MEMBER`          | 409  | User is already in the group                  |
| `ADMIN_TRANSFER_REQUIRED` | 409  | Admin must transfer ownership before leaving  |
| `PAYLOAD_TOO_LARGE`       | 413  | File exceeds the configured size limit        |
| `UNSUPPORTED_FILE_TYPE`   | 415  | Avatar MIME type not allowed                  |
| `TOO_MANY_REQUESTS`       | 429  | Rate limit exceeded                           |
| `INTERNAL_SERVER_ERROR`   | 500  | Unexpected server error                       |
