const { SOCKET_EVENTS } = require('@constants')

module.exports = (io, socket) => {
  socket.on(SOCKET_EVENTS.TYPING_START, ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_START, { userId: socket.userId, chatId })
  })

  socket.on(SOCKET_EVENTS.TYPING_STOP, ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, { userId: socket.userId, chatId })
  })
}
