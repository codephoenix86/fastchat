/**
 * Socket event handlers barrel export
 * Centralizes all socket handlers for easy import
 */
module.exports = {
  chatHandler: require('./chat.handler'),
  messageHandler: require('./message.handler'),
  typingHandler: require('./typing.handler'),
}
