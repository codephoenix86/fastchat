/**
 * Socket event constants
 * Centralized socket event names for better maintainability
 */
module.exports = {
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
}
