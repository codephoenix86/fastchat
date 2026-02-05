# REST API Reference

Complete HTTP API documentation for fastchat.

## Base URL

```
http://localhost:3000
```

## Response Format

All API endpoints return responses in a standardized format.

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": []
  },
  "timestamp": "2024-01-21T10:30:00.000Z",
  "requestId": "uuid"
}
```

### Paginated Response

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

## Authentication

### POST `/api/v1/auth/signup`

Register a new user.

**Request:**

```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "username": "alice",
  "email": "alice@example.com",
  "password": "Secure@123"
}
```

**Validation Rules:**

- `username`: 3-20 characters, must start with a letter, can contain letters, digits, underscores, and dots
- `email`: Valid email format
- `password`: Minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, one digit, and one special character (@$!%\*?&#)

**Response (201):**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "userId",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error
- `409` - Email or username already exists

---

### POST `/api/v1/auth/login`

Authenticate user and receive tokens.

**Request:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "Secure@123"
}
```

**Alternative (login with email):**

```json
{
  "email": "alice@example.com",
  "password": "Secure@123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": {
      "id": "userId",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

**Error Responses:**

- `400` - Validation error
- `401` - Invalid credentials

---

### POST `/api/v1/auth/logout`

Logout user and invalidate refresh token.

**Request:**

```http
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}
Content-Type: application/x-www-form-urlencoded

refresh_token=jwt_refresh_token
```

**Response (200):**

```json
{
  "success": true,
  "message": "User logged out successfully"
}
```

**Error Responses:**

- `400` - Missing refresh token
- `401` - Invalid refresh token

---

### POST `/api/v1/auth/refresh`

Refresh access token using refresh token.

**Request:**

```http
POST /api/v1/auth/refresh
Content-Type: application/x-www-form-urlencoded

refresh_token=jwt_refresh_token
```

**Response (200):**

```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

**Error Responses:**

- `400` - Missing refresh token
- `401` - Invalid or expired refresh token

---

## Users

### GET `/api/v1/users`

Get list of users with pagination and search.

**Request:**

```http
GET /api/v1/users?page=1&limit=20&search=alice&role=user&sort=-createdAt
```

**Query Parameters:**

- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 20, max: 100
- `search` (optional): Search in username or email
- `role` (optional): Filter by role ("user" or "admin")
- `sort` (optional): Sort fields, e.g., "-createdAt,username" (prefix with "-" for descending)

**Response (200):**

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": "userId",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user",
      "avatar": "filename.jpg",
      "bio": "Hello!",
      "lastSeen": "2024-01-21T10:30:00.000Z",
      "createdAt": "2024-01-20T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### GET `/api/v1/users/:id`

Get user by ID.

**Request:**

```http
GET /api/v1/users/507f1f77bcf86cd799439011
```

**Response (200):**

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "user": {
      "id": "userId",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user",
      "avatar": "filename.jpg",
      "bio": "Hello!",
      "lastSeen": "2024-01-21T10:30:00.000Z",
      "createdAt": "2024-01-20T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Invalid user ID
- `404` - User not found

---

### GET `/api/v1/users/me`

Get current authenticated user's profile.

**Request:**

```http
GET /api/v1/users/me
Authorization: Bearer {accessToken}
```

**Response (200):**
Same format as GET `/api/v1/users/:id`

**Error Responses:**

- `400` - Missing authorization token
- `401` - Invalid or expired token

---

### PATCH `/api/v1/users/me`

Update current user's profile.

**Request:**

```http
PATCH /api/v1/users/me
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "newUsername": "newalice",
  "newEmail": "newalice@example.com",
  "newPassword": "NewSecure@123",
  "newBio": "Updated bio",
  "oldPassword": "Secure@123"
}
```

**Validation Rules:**

- `oldPassword`: Required when changing `newEmail` or `newPassword`
- `newUsername`: 3-20 characters, same format as signup
- `newPassword`: Minimum 8 characters with complexity requirements
- `newBio`: Maximum 200 characters
- At least one field (excluding `oldPassword`) must be provided

**Response (200):**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "userId",
      "username": "newalice",
      "email": "newalice@example.com",
      "bio": "Updated bio"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error
- `401` - Invalid old password or token
- `409` - Email or username already taken

---

### DELETE `/api/v1/users/me`

Delete current user's account.

**Request:**

```http
DELETE /api/v1/users/me
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### POST `/api/v1/users/me/avatar`

Upload user avatar.

**Request:**

```http
POST /api/v1/users/me/avatar
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

avatar: [image file]
```

**Validation Rules:**

- File types: jpeg, jpg, png, gif only
- Maximum file size: 5MB

**Response (200):**

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "user": {
      "id": "userId",
      "avatar": "userId-timestamp.jpg"
    }
  }
}
```

**Error Responses:**

- `400` - No file uploaded or invalid file type
- `413` - File too large

---

### DELETE `/api/v1/users/me/avatar`

Remove user avatar.

**Request:**

```http
DELETE /api/v1/users/me/avatar
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Avatar removed successfully",
  "data": {
    "user": {
      "id": "userId",
      "avatar": null
    }
  }
}
```

---

### PATCH `/api/v1/users/me/password`

Change user password.

**Request:**

```http
PATCH /api/v1/users/me/password
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "oldPassword": "Secure@123",
  "newPassword": "NewSecure@456"
}
```

**Validation Rules:**

- Both fields required
- `newPassword`: Minimum 8 characters with complexity requirements

**Response (200):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**

- `400` - Validation error
- `401` - Invalid old password

---

## Chats

All chat endpoints require authentication.

### GET `/api/v1/chats`

Get user's chats with pagination.

**Request:**

```http
GET /api/v1/chats?page=1&limit=20&type=group&sort=-createdAt
Authorization: Bearer {accessToken}
```

**Query Parameters:**

- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 20, max: 100
- `type` (optional): Filter by type ("private" or "group")
- `sort` (optional): Sort fields, e.g., "-createdAt"

**Response (200):**

```json
{
  "success": true,
  "message": "Chats fetched successfully",
  "data": [
    {
      "id": "chatId",
      "type": "group",
      "name": "Team Chat",
      "picture": null,
      "admin": "userId",
      "participants": [
        {
          "id": "userId1",
          "username": "alice",
          "avatar": "avatar.jpg"
        }
      ],
      "createdAt": "2024-01-20T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### POST `/api/v1/chats`

Create a new chat.

**Request (Private Chat):**

```http
POST /api/v1/chats
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "type": "private",
  "participants": ["userId2"]
}
```

**Request (Group Chat):**

```json
{
  "type": "group",
  "groupName": "Team Chat",
  "participants": ["userId1", "userId2"]
}
```

**Validation Rules:**

- `type`: Must be "private" or "group"
- `groupName`: Required for group chats, 1-50 characters
- `participants`: Array of user IDs
  - Private chat: Must result in exactly 2 unique participants (including creator)
  - Group chat: Must result in at least 2 unique participants (including creator)
- All participant IDs must be valid MongoDB ObjectIds and exist in database

**Response (201):**

```json
{
  "success": true,
  "message": "Chat created successfully",
  "data": {
    "chat": {
      "id": "chatId",
      "type": "group",
      "name": "Team Chat",
      "admin": "creatorUserId",
      "participants": ["userId1", "userId2", "creatorUserId"],
      "createdAt": "2024-01-21T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error (invalid participants, missing group name, etc.)
- `401` - Unauthorized

---

### GET `/api/v1/chats/:chatId`

Get chat details by ID.

**Request:**

```http
GET /api/v1/chats/507f1f77bcf86cd799439011
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Chat fetched successfully",
  "data": {
    "chat": {
      "id": "chatId",
      "type": "group",
      "name": "Team Chat",
      "admin": {
        "id": "userId",
        "username": "alice",
        "avatar": "avatar.jpg"
      },
      "participants": [
        {
          "id": "userId1",
          "username": "alice",
          "avatar": "avatar.jpg",
          "email": "alice@example.com"
        }
      ],
      "createdAt": "2024-01-20T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Invalid chat ID
- `403` - User is not a participant
- `404` - Chat not found

---

### PATCH `/api/v1/chats/:chatId`

Update chat details (group chats only, admin only).

**Request:**

```http
PATCH /api/v1/chats/507f1f77bcf86cd799439011
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "groupName": "New Team Chat",
  "groupPicture": "picture_url",
  "admin": "newAdminUserId"
}
```

**Validation Rules:**

- Only works for group chats
- Only admin can update
- At least one field must be provided
- `groupName`: 1-50 characters if provided
- `admin`: Must be a valid participant ID

**Response (200):**

```json
{
  "success": true,
  "message": "Chat updated successfully",
  "data": {
    "chat": {
      "id": "chatId",
      "name": "New Team Chat"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error (private chat, no fields provided, etc.)
- `403` - User is not admin
- `404` - Chat not found

---

### DELETE `/api/v1/chats/:chatId`

Delete chat (group chats only, admin only).

**Request:**

```http
DELETE /api/v1/chats/507f1f77bcf86cd799439011
Authorization: Bearer {accessToken}
```

**Validation Rules:**

- Only works for group chats
- Only admin can delete

**Response (200):**

```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

**Error Responses:**

- `400` - Cannot delete private chat
- `403` - User is not admin
- `404` - Chat not found

---

### GET `/api/v1/chats/:chatId/members`

Get chat members.

**Request:**

```http
GET /api/v1/chats/507f1f77bcf86cd799439011/members
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Members fetched successfully",
  "data": {
    "members": [
      {
        "id": "userId1",
        "username": "alice",
        "email": "alice@example.com",
        "avatar": "avatar.jpg",
        "bio": "Hello!"
      }
    ]
  }
}
```

---

### POST `/api/v1/chats/:chatId/members`

Add member to group chat.

**Request:**

```http
POST /api/v1/chats/507f1f77bcf86cd799439011/members
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "userId": "userIdToAdd"
}
```

**Validation Rules:**

- Only works for group chats
- Only admin can add members (or user can add themselves)
- User must not already be a member
- Must be a valid user ID

**Response (200):**

```json
{
  "success": true,
  "message": "Member added successfully"
}
```

**Error Responses:**

- `400` - User already a member or invalid user ID
- `403` - Not authorized to add members
- `404` - Chat or user not found

---

### DELETE `/api/v1/chats/:chatId/members/:userId`

Remove member from group chat.

**Request:**

```http
DELETE /api/v1/chats/507f1f77bcf86cd799439011/members/me
Authorization: Bearer {accessToken}
```

Or to remove another user:

```http
DELETE /api/v1/chats/507f1f77bcf86cd799439011/members/507f1f77bcf86cd799439022
```

**Validation Rules:**

- Only works for group chats
- Users can remove themselves, or admin can remove others
- Use "me" as userId to remove yourself
- Admin cannot leave without transferring ownership first
- Chat is deleted if last member leaves

**Response (200):**

```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Error Responses:**

- `400` - Cannot remove from private chat
- `403` - Not authorized (admin trying to leave without transfer)
- `404` - Chat or user not found

---

## Messages

All message endpoints require authentication.

### POST `/api/v1/chats/:chatId/messages`

Send a message to a chat.

**Request:**

```http
POST /api/v1/chats/507f1f77bcf86cd799439011/messages
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "content": "Hello, world!"
}
```

**Validation Rules:**

- `content`: Required, non-empty string, maximum 5000 characters
- User must be a participant of the chat

**Response (201):**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "messageId",
      "content": "Hello, world!",
      "sender": "userId",
      "chat": "chatId",
      "status": "sent",
      "type": "text",
      "createdAt": "2024-01-21T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error (empty content, too long, etc.)
- `403` - User is not a participant
- `404` - Chat not found

---

### GET `/api/v1/chats/:chatId/messages`

Get messages from a chat with pagination.

**Request:**

```http
GET /api/v1/chats/507f1f77bcf86cd799439011/messages?page=1&limit=50&sort=createdAt
Authorization: Bearer {accessToken}
```

**Query Parameters:**

- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 50, max: 100
- `sort` (optional): Sort fields, default: "createdAt" (ascending)

**Response (200):**

```json
{
  "success": true,
  "message": "Messages fetched successfully",
  "data": [
    {
      "id": "messageId",
      "content": "Hello!",
      "sender": {
        "id": "userId",
        "username": "alice",
        "avatar": "avatar.jpg"
      },
      "chat": "chatId",
      "status": "read",
      "type": "text",
      "createdAt": "2024-01-21T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 200,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### GET `/api/v1/chats/:chatId/messages/:messageId`

Get a specific message by ID.

**Request:**

```http
GET /api/v1/chats/507f1f77bcf86cd799439011/messages/507f1f77bcf86cd799439022
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Message fetched successfully",
  "data": {
    "message": {
      "id": "messageId",
      "content": "Hello!",
      "sender": {
        "id": "userId",
        "username": "alice",
        "avatar": "avatar.jpg"
      },
      "chat": "chatId",
      "status": "read",
      "type": "text",
      "createdAt": "2024-01-21T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Invalid message ID
- `403` - User is not in the chat
- `404` - Message not found

---

### PATCH `/api/v1/chats/:chatId/messages/:messageId`

Edit a message.

**Request:**

```http
PATCH /api/v1/chats/507f1f77bcf86cd799439011/messages/507f1f77bcf86cd799439022
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "content": "Updated message content"
}
```

**Validation Rules:**

- `content`: Required, non-empty string, maximum 5000 characters
- Only the message sender can edit their own messages

**Response (200):**

```json
{
  "success": true,
  "message": "Message updated successfully",
  "data": {
    "message": {
      "id": "messageId",
      "content": "Updated message content",
      "sender": "userId",
      "chat": "chatId",
      "status": "sent",
      "type": "text",
      "createdAt": "2024-01-21T10:30:00.000Z",
      "updatedAt": "2024-01-21T10:35:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` - Validation error
- `403` - User is not the message sender
- `404` - Message not found

---

### DELETE `/api/v1/chats/:chatId/messages/:messageId`

Delete a message.

**Request:**

```http
DELETE /api/v1/chats/507f1f77bcf86cd799439011/messages/507f1f77bcf86cd799439022
Authorization: Bearer {accessToken}
```

**Validation Rules:**

- Only the message sender can delete their own messages

**Response (200):**

```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Error Responses:**

- `400` - Invalid message ID
- `403` - User is not the message sender
- `404` - Message not found

---

## Health Check

### GET `/health`

Check application health status.

**Request:**

```http
GET /health
```

**Response (200):**

```json
{
  "uptime": 123.456,
  "timestamp": 1705838400000,
  "status": "OK",
  "environment": "development",
  "version": "1.0.0",
  "checks": {
    "database": "connected"
  }
}
```

**Response (503) - Database Disconnected:**

```json
{
  "uptime": 123.456,
  "timestamp": 1705838400000,
  "status": "DEGRADED",
  "environment": "development",
  "version": "1.0.0",
  "checks": {
    "database": "disconnected"
  }
}
```

---

## Error Codes

| Code                    | Status | Description              |
| ----------------------- | ------ | ------------------------ |
| `VALIDATION_ERROR`      | 400    | Input validation failed  |
| `AUTHENTICATION_ERROR`  | 401    | Invalid or expired token |
| `FORBIDDEN`             | 403    | Insufficient permissions |
| `NOT_FOUND`             | 404    | Resource not found       |
| `CONFLICT`              | 409    | Duplicate resource       |
| `PAYLOAD_TOO_LARGE`     | 413    | File too large           |
| `RATE_LIMIT_EXCEEDED`   | 429    | Too many requests        |
| `INTERNAL_SERVER_ERROR` | 500    | Server error             |

## Rate Limiting

Currently not implemented, but the error code is reserved for future use.

## Postman Collection

Import this base collection to get started:

```json
{
  "info": {
    "name": "fastchat API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "accessToken",
      "value": ""
    }
  ]
}
```

Set the `accessToken` variable after login to automatically include it in authenticated requests.
