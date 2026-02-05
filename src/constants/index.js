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

  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },
}
