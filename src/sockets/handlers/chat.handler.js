const { SOCKET_EVENTS } = require('@constants')

module.exports = (io, socket) => {
  socket.on(SOCKET_EVENTS.CHAT_JOIN, ({ chatId }) => socket.join(chatId))
  socket.on(SOCKET_EVENTS.CHAT_LEAVE, ({ chatId }) => socket.leave(chatId))
}
