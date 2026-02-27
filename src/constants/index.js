module.exports = {
  CHAT_TYPES: {
    PRIVATE: 'private',
    GROUP: 'group',
  },
  MESSAGE_TYPES: {
    TEXT: 'text',
    FILE: 'file',
  },
  MESSAGE_STATUS: {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
  },
  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
  },
  VALIDATION: {
    USERNAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 20,
      REGEX: /^(?=[^.]*\.?[^.]*$)[a-zA-Z](?!.*[_]{2})[a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/,
    },
    PASSWORD: {
      MIN_LENGTH: 8,
      REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
    },
    BIO: {
      MAX_LENGTH: 200,
    },
    FILE: {
      MAX_SIZE: 5 * 1024 * 1024, // 5MB
      ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    },
  },
  SOCKET_EVENTS: {
    // Connection events
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',

    // Chat events
    CHAT_JOIN: 'chat:join',
    CHAT_LEAVE: 'chat:leave',

    // Message events
    MESSAGE_NEW: 'message:new',
    MESSAGE_UPDATED: 'message:updated',
    MESSAGE_DELETED: 'message:deleted',
    MESSAGE_DELIVERED: 'message:delivered',
    MESSAGE_READ: 'message:read',

    // Typing events
    TYPING_START: 'message:start-typing',
    TYPING_STOP: 'message:stop-typing',

    // User events
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
  },
}
