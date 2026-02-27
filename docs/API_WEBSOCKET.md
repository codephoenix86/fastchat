# WebSocket API Reference

Real-time communication using Socket.io for the fastchat application.

## Connection

### Establishing a Connection

Pass your JWT access token in the `auth` object during handshake:

```javascript
import io from 'socket.io-client'

const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' },
})
```

The server verifies the token before the connection is accepted. If verification fails, `connect_error` is fired and the socket is rejected.

### Connection Events

```javascript
socket.on('connect', () => {
  console.log('Connected, socket ID:', socket.id)
})

socket.on('disconnect', (reason) => {
  // 'io server disconnect' | 'io client disconnect' |
  // 'ping timeout' | 'transport close' | 'transport error'
  console.log('Disconnected:', reason)
})

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message)
  // e.g. 'Authorization token missing'
})
```

---

## Online Presence

When a user's **first** socket connects, the server broadcasts `user:online` to all other connected sockets. When their **last** socket disconnects, `user:offline` is broadcast. Multiple browser tabs or devices are handled transparently — only the first/last connection triggers the broadcast.

### `user:online` (server → client)

```javascript
socket.on('user:online', ({ userId }) => {
  // Mark userId as online in your UI
})
```

### `user:offline` (server → client)

```javascript
socket.on('user:offline', ({ userId }) => {
  // Mark userId as offline / show last-seen
})
```

---

## Chat Room Events

Join a chat room to receive its real-time message and typing events.

### `chat:join` (client → server)

```javascript
socket.emit('chat:join', { chatId: '<chatId>' })
```

Emit when the user opens a chat view. Only participants may join (validated by the Socket.io auth middleware via the access token).

### `chat:leave` (client → server)

```javascript
socket.emit('chat:leave', { chatId: '<chatId>' })
```

Emit when the user navigates away from a chat. Good practice to reduce server memory usage.

---

## Message Events

### Sending messages

Messages are sent via the **REST API** (`POST /api/v1/chats/:chatId/messages`), not directly over the socket. The server emits `message:new` to the chat room after persisting the message.

### `message:new` (server → client)

```javascript
socket.on('message:new', (message) => {
  // Render the message in the UI
  // Then emit message:delivered so the sender knows it arrived
  socket.emit('message:delivered', { messageId: message.id })
})
```

**Payload**

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

### `message:updated` (server → client)

Emitted after a successful `PATCH /messages/:id` REST call.

```javascript
socket.on('message:updated', (message) => {
  // Replace the existing message in the UI with the updated one
})
```

### `message:deleted` (server → client)

Emitted after a successful `DELETE /messages/:id` REST call.

```javascript
socket.on('message:deleted', ({ messageId }) => {
  // Remove the message from the UI
})
```

### `message:delivered` (client → server)

Tell the server that the message was rendered on the client.

```javascript
socket.emit('message:delivered', { messageId: '<messageId>' })
```

### `message:read` (client → server)

Tell the server that the user actually read the message (e.g. it scrolled into the viewport).

```javascript
// Example using Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && document.hasFocus()) {
      socket.emit('message:read', {
        messageId: entry.target.dataset.messageId,
      })
    }
  })
})
```

---

## Typing Events

### `message:start-typing` (client → server)

Notify other participants that the current user is typing.

```javascript
socket.emit('message:start-typing', { chatId: '<chatId>' })
```

**Best practice — debounce to avoid flooding:**

```javascript
let typingTimeout

function onInput(chatId, value) {
  if (!value.length) {
    clearTimeout(typingTimeout)
    socket.emit('message:stop-typing', { chatId })
    return
  }

  clearTimeout(typingTimeout)
  socket.emit('message:start-typing', { chatId })

  typingTimeout = setTimeout(() => {
    socket.emit('message:stop-typing', { chatId })
  }, 3000)
}
```

### `message:stop-typing` (client → server)

```javascript
socket.emit('message:stop-typing', { chatId: '<chatId>' })
```

Emit when the user clears the input, sends a message, or the 3-second inactivity timeout fires.

### `message:start-typing` (server → client)

Broadcast to all other users currently in the chat room.

```javascript
socket.on('message:start-typing', ({ userId, chatId }) => {
  // Show "User is typing…" indicator
})
```

### `message:stop-typing` (server → client)

```javascript
socket.on('message:stop-typing', ({ userId, chatId }) => {
  // Hide typing indicator for this user
})
```

---

## Complete Client Example

```javascript
import io from 'socket.io-client'

class ChatClient {
  constructor(accessToken) {
    this.socket = io('http://localhost:3000', {
      auth: { token: accessToken },
    })
    this.activeChats = new Set()
    this._setup()
  }

  _setup() {
    const { socket } = this

    socket.on('connect', () => {
      // Re-join active chats after reconnect
      this.activeChats.forEach((chatId) => socket.emit('chat:join', { chatId }))
    })

    socket.on('message:new', (msg) => {
      this.renderMessage(msg)
      socket.emit('message:delivered', { messageId: msg.id })
    })

    socket.on('message:updated', (msg) => this.updateMessage(msg))
    socket.on('message:deleted', ({ messageId }) => this.removeMessage(messageId))

    socket.on('message:start-typing', ({ userId }) => this.showTyping(userId))
    socket.on('message:stop-typing', ({ userId }) => this.hideTyping(userId))

    socket.on('user:online', ({ userId }) => this.setStatus(userId, 'online'))
    socket.on('user:offline', ({ userId }) => this.setStatus(userId, 'offline'))
  }

  openChat(chatId) {
    this.activeChats.add(chatId)
    this.socket.emit('chat:join', { chatId })
  }

  closeChat(chatId) {
    this.activeChats.delete(chatId)
    this.socket.emit('chat:leave', { chatId })
  }

  markRead(messageId) {
    this.socket.emit('message:read', { messageId })
  }

  // Implement UI methods:
  renderMessage(msg) {
    /* … */
  }
  updateMessage(msg) {
    /* … */
  }
  removeMessage(id) {
    /* … */
  }
  showTyping(userId) {
    /* … */
  }
  hideTyping(userId) {
    /* … */
  }
  setStatus(userId, status) {
    /* … */
  }
}

const client = new ChatClient(accessToken)
client.openChat('<chatId>')
```

---

## Event Summary

### Client → Server

| Event                  | Payload         | Description                  |
| ---------------------- | --------------- | ---------------------------- |
| `chat:join`            | `{ chatId }`    | Subscribe to a chat room     |
| `chat:leave`           | `{ chatId }`    | Unsubscribe from a chat room |
| `message:delivered`    | `{ messageId }` | Confirm message was rendered |
| `message:read`         | `{ messageId }` | Confirm message was read     |
| `message:start-typing` | `{ chatId }`    | User started typing          |
| `message:stop-typing`  | `{ chatId }`    | User stopped typing          |

### Server → Client

| Event                  | Payload              | Description                  |
| ---------------------- | -------------------- | ---------------------------- |
| `message:new`          | full message object  | New message in a joined room |
| `message:updated`      | full message object  | Message was edited           |
| `message:deleted`      | `{ messageId }`      | Message was deleted          |
| `message:start-typing` | `{ userId, chatId }` | Another user started typing  |
| `message:stop-typing`  | `{ userId, chatId }` | Another user stopped typing  |
| `user:online`          | `{ userId }`         | User came online             |
| `user:offline`         | `{ userId }`         | User went offline            |
