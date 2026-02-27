# REST API Reference

Complete HTTP API documentation for fastchat.

## Base URL

```
http://localhost:3000
```

---

## Response Format

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  },
  "timestamp": "2024-01-21T10:30:00.000Z",
  "requestId": "uuid"
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

---

## Authentication

fastchat uses a two-token scheme:

- **Access token** — short-lived JWT (`15m` default), sent in the `Authorization: Bearer` header.
- **Refresh token** — long-lived opaque token (`7d` default), stored in Redis, sent as a `application/x-www-form-urlencoded` body field.

### POST `/api/v1/auth/signup`

Register a new user account. Rate-limited to 5 requests per 15 minutes.

**Request body** (`application/json`)

| Field      | Type   | Rules                                                                    |
| ---------- | ------ | ------------------------------------------------------------------------ |
| `username` | string | 3–20 chars, must start with a letter, letters/digits/`_`/`.` only        |
| `email`    | string | valid email format                                                       |
| `password` | string | min 8 chars, requires uppercase, lowercase, digit, and one of `@$!%*?&#` |

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

### POST `/api/v1/auth/login`

Authenticate and receive tokens. Rate-limited to 5 requests per 15 minutes.

**Request body** (`application/json`)

Provide either `username` or `email`, but not both.

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

**Errors** — `400` validation failed · `401` invalid credentials

---

### POST `/api/v1/auth/logout`

Revoke the refresh token. The access token is not invalidated server-side (it expires naturally).

**Headers** — `Authorization: Bearer <accessToken>` (optional, but recommended)

**Request body** (`application/x-www-form-urlencoded`)

```
refresh_token=<opaque>
```

**Response `200`**

```json
{ "success": true, "message": "User logged out successfully" }
```

**Errors** — `400` missing refresh token · `401` token not found or already revoked

---

### POST `/api/v1/auth/refresh`

Rotate the token pair. The old refresh token is deleted; a new pair is issued.

**Request body** (`application/x-www-form-urlencoded`)

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

**Errors** — `400` missing token · `401` token not found or expired

---

## Users

All protected routes require `Authorization: Bearer <accessToken>`.

### GET `/api/v1/users`

List users. No authentication required.

**Query parameters**

| Param    | Description                                                                | Default       |
| -------- | -------------------------------------------------------------------------- | ------------- |
| `page`   | Page number                                                                | `1`           |
| `limit`  | Items per page (max 100)                                                   | `20`          |
| `search` | Search in username and email                                               | —             |
| `role`   | Filter by role (`user` \| `admin`)                                         | —             |
| `sort`   | Comma-separated fields, prefix `-` for descending (`-created_at,username`) | `-created_at` |

**Response `200`** — paginated user array (no `password_hash`)

---

### GET `/api/v1/users/:id`

Get a user by their UUID. No authentication required.

**Errors** — `400` invalid UUID format · `404` user not found

---

### GET `/api/v1/users/me`

Get the currently authenticated user's full profile.

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
      "avatar": "uuid-timestamp.jpg",
      "bio": "Hello!",
      "lastSeen": "2024-01-21T10:30:00.000Z",
      "createdAt": "2024-01-20T10:00:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Errors** — `401` missing or invalid token

---

### PATCH `/api/v1/users/me`

Update profile fields. Provide at least one field.

**Request body** (`application/json`)

| Field      | Type   | Rules                    |
| ---------- | ------ | ------------------------ |
| `username` | string | 3–20 chars, valid format |
| `bio`      | string | max 200 chars            |

At least one of the above fields must be present.

**Response `200`** — updated user object

**Errors** — `400` validation failed · `409` username already taken

---

### DELETE `/api/v1/users/me`

Permanently delete the authenticated user's account. Also deletes their avatar file if present.

**Response `200`**

```json
{ "success": true, "message": "Account deleted successfully" }
```

---

### POST `/api/v1/users/me/avatar`

Upload a profile picture.

**Request** — `multipart/form-data` with field name `avatar`

Accepted types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`. Max size: 5 MB.

**Response `200`**

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": { "user": { "id": "uuid", "avatar": "uuid-timestamp.jpg" } }
}
```

**Errors** — `400` no file provided · `413` file too large · `415` unsupported file type

---

### DELETE `/api/v1/users/me/avatar`

Remove the current avatar. Safe to call even when no avatar is set.

**Response `200`**

```json
{
  "success": true,
  "message": "Avatar removed successfully",
  "data": { "user": { "id": "uuid", "avatar": null } }
}
```

---

### PATCH `/api/v1/users/me/password`

Change the account password.

**Request body** (`application/json`)

| Field             | Type   | Rules                                                                  |
| ----------------- | ------ | ---------------------------------------------------------------------- |
| `currentPassword` | string | required                                                               |
| `newPassword`     | string | min 8 chars, same complexity rules as signup, must differ from current |

**Response `200`**

```json
{ "success": true, "message": "Password changed successfully" }
```

**Errors** — `400` validation failed · `401` current password incorrect

---

## Chats

All chat endpoints require `Authorization: Bearer <accessToken>`.

### GET `/api/v1/chats`

Get the authenticated user's chats.

**Query parameters**

| Param   | Description          | Default      |
| ------- | -------------------- | ------------ |
| `page`  | Page number          | `1`          |
| `limit` | Max 100              | `20`         |
| `type`  | `private` or `group` | —            |
| `sort`  | e.g. `-createdAt`    | `-createdAt` |

**Response `200`** — paginated chat array

---

### POST `/api/v1/chats`

Create a new chat.

**Private chat** — `participants` must contain exactly one other user ID.

```json
{
  "type": "private",
  "participants": ["<userId>"]
}
```

**Group chat** — `participants` must contain at least one other user ID. Creator is added automatically as admin.

```json
{
  "type": "group",
  "groupName": "Team Chat",
  "participants": ["<userId1>", "<userId2>"]
}
```

**Validation rules**

- All participant IDs must be valid UUIDs and exist in the database.
- Duplicate participant IDs are rejected.
- `groupName` is required for group chats and forbidden for private chats.

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

### GET `/api/v1/chats/:chatId`

Get a single chat by ID. The requesting user must be a participant.

**Errors** — `400` invalid UUID · `403` not a participant · `404` chat not found

---

### PATCH `/api/v1/chats/:chatId`

Update a group chat. Admin only. Provide at least one field.

**Request body** (`application/json`)

| Field       | Type          | Notes                           |
| ----------- | ------------- | ------------------------------- |
| `groupName` | string        | 1–50 chars                      |
| `admin`     | string (UUID) | Must be an existing participant |

**Errors** — `400` private chat or no fields · `403` not admin · `404` not found

---

### DELETE `/api/v1/chats/:chatId`

Delete a group chat. Admin only.

**Errors** — `400` private chat · `403` not admin · `404` not found

---

### GET `/api/v1/chats/:chatId/members`

Get the full member list. User must be a participant.

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

### POST `/api/v1/chats/:chatId/members/:userId`

Add a member to a group chat. Admin only.

**Errors** — `400` private chat · `403` not admin · `404` user not found · `409` already a member

---

### DELETE `/api/v1/chats/:chatId/members/me`

Leave a group chat. If the admin tries to leave while other members remain, they must transfer ownership first (see `PATCH /chats/:chatId`). The chat is deleted automatically when the last member leaves.

**Errors** — `400` private chat · `409` admin must transfer ownership first

---

### DELETE `/api/v1/chats/:chatId/members/:userId`

Remove another member from a group chat. Admin only. Same auto-delete rule applies.

**Errors** — `400` private chat · `403` not admin · `404` user not found

---

## Messages

All message endpoints require `Authorization: Bearer <accessToken>`. Rate-limited to 100 requests per 15 minutes.

### POST `/api/v1/chats/:chatId/messages`

Send a message. A `message:new` Socket.io event is broadcast to the chat room immediately.

**Request body** (`application/json`)

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

### GET `/api/v1/chats/:chatId/messages`

Fetch paginated messages. Default sort is ascending by `createdAt` (oldest first).

**Query parameters** — `page`, `limit` (max 100, default 50), `sort`

---

### GET `/api/v1/chats/:chatId/messages/:messageId`

Fetch a single message. User must be a participant.

---

### PATCH `/api/v1/chats/:chatId/messages/:messageId`

Edit a message. Only the original sender can edit. A `message:updated` event is broadcast.

**Request body** — `{ "content": "Updated text" }`

---

### DELETE `/api/v1/chats/:chatId/messages/:messageId`

Delete a message. Only the original sender can delete. A `message:deleted` event is broadcast.

---

## Health Check

### GET `/health`

Check application and database connectivity. No authentication required.

**Response `200`** when all healthy, `503` when any check fails.

```json
{
  "uptime": 123.4,
  "timestamp": 1705838400000,
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

---

## Error Codes

| Code                      | HTTP Status | Description                                  |
| ------------------------- | ----------- | -------------------------------------------- |
| `VALIDATION_FAILED`       | 400         | Joi schema validation failed                 |
| `BAD_REQUEST`             | 400         | General bad request                          |
| `MISSING_TOKEN`           | 401         | Authorization header absent                  |
| `INVALID_TOKEN`           | 401         | Token malformed or wrong signature           |
| `TOKEN_EXPIRED`           | 401         | Access token has expired                     |
| `INVALID_CREDENTIALS`     | 401         | Wrong username/email or password             |
| `INVALID_PASSWORD`        | 401         | Incorrect current password                   |
| `SESSION_NOT_FOUND`       | 401         | Refresh token not in Redis                   |
| `REFRESH_TOKEN_REVOKED`   | 401         | Refresh token deleted or expired             |
| `FORBIDDEN`               | 403         | Action not permitted                         |
| `NOT_A_MEMBER`            | 403         | User is not a chat participant               |
| `ADMIN_REQUIRED`          | 403         | Only group admin may perform this action     |
| `NOT_MESSAGE_OWNER`       | 403         | Only message sender may edit/delete          |
| `NOT_FOUND`               | 404         | Resource does not exist                      |
| `EMAIL_ALREADY_EXISTS`    | 409         | Duplicate email                              |
| `USERNAME_ALREADY_TAKEN`  | 409         | Duplicate username                           |
| `ALREADY_MEMBER`          | 409         | User is already in the group                 |
| `ADMIN_TRANSFER_REQUIRED` | 409         | Admin must transfer ownership before leaving |
| `UNSUPPORTED_FILE_TYPE`   | 415         | Avatar file type not allowed                 |
| `PAYLOAD_TOO_LARGE`       | 413         | File exceeds size limit                      |
| `INTERNAL_SERVER_ERROR`   | 500         | Unexpected server error                      |
