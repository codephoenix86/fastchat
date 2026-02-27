/**
 * Socket event handlers barrel export
 * Centralizes all socket handlers for easy import
 */
module.exports = {
  registerChatHandlers: require('./chat.handler'),
  registerMessageHandlers: require('./message.handler'),
  registerTypingHandlers: require('./typing.handler'),
}
