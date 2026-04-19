# WebSocket API Reference

Real-time features for fastchat are built on [Socket.io 4.x](https://socket.io/).

---

## Overview

The WebSocket layer handles everything that needs to happen in real-time:

- **Message delivery** — new, updated, and deleted messages broadcast to chat rooms
- **Delivery & read receipts** — clients report when a message was rendered or read
- **Typing indicators** — start/stop typing signals forwarded to room participants
- **Online presence** — first-connect / last-disconnect broadcasts across the app

**Messages are sent via the REST API** (`POST /api/v1/chats/:chatId/messages`), not directly over the socket. The server persists the message then emits `message:new` to the room.

---

## Connection

Authenticate by passing your JWT access token in the `auth` object during the handshake. The server verifies the token before the connection is accepted.

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
})
```

If verification fails the socket is rejected and `connect_error` fires on the client:

```js
socket.on('connect_error', (error) => {
  // error.message: 'Authorization token missing' | 'Invalid or expired token'
  console.error('Connection rejected:', error.message)
})
```

### Reconnection

Socket.io reconnects automatically on network interruptions. Re-join any active chat rooms on reconnect, because room membership is not persisted across connections:

```js
socket.on('connect', () => {
  activeChats.forEach((chatId) => socket.emit('chat:join', { chatId }))
})
```

---

## Event Reference

### Client → Server

| Event                  | Payload                 | Description                                                                    |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `chat:join`            | `{ chatId: string }`    | Subscribe to a chat room to receive message and typing events                  |
| `chat:leave`           | `{ chatId: string }`    | Unsubscribe from a chat room                                                   |
| `message:delivered`    | `{ messageId: string }` | Report that a message was rendered; updates status to `'delivered'` in MongoDB |
| `message:read`         | `{ messageId: string }` | Report that the user read a message; updates status to `'read'` in MongoDB     |
| `message:start-typing` | `{ chatId: string }`    | Signal that the current user started typing                                    |
| `message:stop-typing`  | `{ chatId: string }`    | Signal that the current user stopped typing                                    |

### Server → Client

| Event                  | Payload                              | Trigger                                    |
| ---------------------- | ------------------------------------ | ------------------------------------------ |
| `user:online`          | `{ userId: string }`                 | A user's first socket connected            |
| `user:offline`         | `{ userId: string }`                 | A user's last socket disconnected          |
| `message:new`          | full message object                  | Message created via `POST /messages`       |
| `message:updated`      | full message object                  | Message edited via `PATCH /messages/:id`   |
| `message:deleted`      | `{ messageId: string }`              | Message deleted via `DELETE /messages/:id` |
| `message:start-typing` | `{ userId: string, chatId: string }` | Forwarded to room (not back to sender)     |
| `message:stop-typing`  | `{ userId: string, chatId: string }` | Forwarded to room (not back to sender)     |

---

## Online Presence

When a user's **first** socket connects, `user:online` is broadcast to all other connected clients. When their **last** socket disconnects, `user:offline` is broadcast. Multiple tabs and devices are handled transparently — only the true first/last connection triggers the event.

```js
socket.on('user:online', ({ userId }) => {
  updatePresenceUI(userId, 'online')
})

socket.on('user:offline', ({ userId }) => {
  updatePresenceUI(userId, 'offline')
})
```

---

## Chat Room Events

Join a room when the user opens a chat view. Leave when they navigate away.

```js
// Opening a chat
socket.emit('chat:join', { chatId })

// Closing a chat (good practice — reduces server memory)
socket.emit('chat:leave', { chatId })
```

Only participants in the chat may join its room. Non-participants who attempt to join will have the event ignored.

---

## Message Events

### Receiving new messages

```js
socket.on('message:new', (message) => {
  renderMessage(message)

  // Immediately report delivery so the sender's status updates
  socket.emit('message:delivered', { messageId: message.id })
})
```

**Message payload shape:**

```json
{
  "id": "<messageId>",
  "content": "Hello!",
  "sender": "<userId>",
  "chat": "<chatId>",
  "status": "sent",
  "type": "text",
  "createdAt": "2024-01-21T10:30:00.000Z",
  "updatedAt": "2024-01-21T10:30:00.000Z"
}
```

### Edits and deletions

```js
socket.on('message:updated', (message) => {
  replaceMessageInUI(message.id, message)
})

socket.on('message:deleted', ({ messageId }) => {
  removeMessageFromUI(messageId)
})
```

### Marking messages as read

Emit `message:read` when a message scrolls into the viewport and the window has focus:

```js
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting && document.hasFocus()) {
      socket.emit('message:read', {
        messageId: entry.target.dataset.messageId,
      })
    }
  }
})
```

---

## Typing Indicators

Debounce the `message:start-typing` event to avoid flooding the server. Emit `message:stop-typing` when the input clears, a message is sent, or a 3-second inactivity timeout fires.

```js
let typingTimer

function onInputChange(chatId, value) {
  clearTimeout(typingTimer)

  if (!value) {
    socket.emit('message:stop-typing', { chatId })
    return
  }

  socket.emit('message:start-typing', { chatId })

  typingTimer = setTimeout(() => {
    socket.emit('message:stop-typing', { chatId })
  }, 3000)
}
```

Receive typing events from other participants (the server never echoes events back to the sender):

```js
socket.on('message:start-typing', ({ userId, chatId }) => {
  showTypingIndicator(userId, chatId)
})

socket.on('message:stop-typing', ({ userId, chatId }) => {
  hideTypingIndicator(userId, chatId)
})
```

---

## Complete Client Example

A minimal but complete Socket.io client class covering all events:

```js
import { io } from 'socket.io-client'

class FastChatClient {
  constructor(accessToken, baseUrl = 'http://localhost:3000') {
    this.socket = io(baseUrl, { auth: { token: accessToken } })
    this.activeChats = new Set()
    this._bindEvents()
  }

  _bindEvents() {
    const { socket } = this

    // Re-join rooms after reconnect
    socket.on('connect', () => {
      this.activeChats.forEach((chatId) => socket.emit('chat:join', { chatId }))
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
    })

    // Messages
    socket.on('message:new', (msg) => {
      this.onNewMessage(msg)
      socket.emit('message:delivered', { messageId: msg.id })
    })

    socket.on('message:updated', (msg) => this.onMessageUpdated(msg))
    socket.on('message:deleted', ({ messageId }) => this.onMessageDeleted(messageId))

    // Typing
    socket.on('message:start-typing', ({ userId, chatId }) => {
      this.onTypingStart(userId, chatId)
    })
    socket.on('message:stop-typing', ({ userId, chatId }) => {
      this.onTypingStop(userId, chatId)
    })

    // Presence
    socket.on('user:online', ({ userId }) => this.onUserOnline(userId))
    socket.on('user:offline', ({ userId }) => this.onUserOffline(userId))
  }

  // ── Room management ──────────────────────────────────────────

  openChat(chatId) {
    this.activeChats.add(chatId)
    this.socket.emit('chat:join', { chatId })
  }

  closeChat(chatId) {
    this.activeChats.delete(chatId)
    this.socket.emit('chat:leave', { chatId })
  }

  // ── Receipts ─────────────────────────────────────────────────

  markRead(messageId) {
    this.socket.emit('message:read', { messageId })
  }

  // ── Typing ───────────────────────────────────────────────────

  startTyping(chatId) {
    this.socket.emit('message:start-typing', { chatId })
  }

  stopTyping(chatId) {
    this.socket.emit('message:stop-typing', { chatId })
  }

  // ── Implement these in your UI layer ─────────────────────────

  onNewMessage(message) {
    /* render message */
  }
  onMessageUpdated(message) {
    /* replace existing message */
  }
  onMessageDeleted(messageId) {
    /* remove from UI */
  }
  onTypingStart(userId, chatId) {
    /* show typing indicator */
  }
  onTypingStop(userId, chatId) {
    /* hide typing indicator */
  }
  onUserOnline(userId) {
    /* update presence indicator */
  }
  onUserOffline(userId) {
    /* update presence indicator */
  }
}

// Usage
const client = new FastChatClient(accessToken)
client.openChat('<chatId>')
```
