const { Server } = require('socket.io')
const { addSocket, removeSocket, onlineUsers } = require('./users')
const { User } = require('../models')
const chats = require('./chat')
let io = undefined
exports.init = server => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })
  io.on('connection', async socket => {
    console.log('new socket connected:', socket.id)
    const { userId } = socket.handshake.auth
    chats(io, socket)
    addSocket(userId, socket.id)
    if (onlineUsers[userId].size == 1)
      socket.broadcast.emit('user:online', { userId })
    socket.on('disconnect', async reason => {
      console.log('socket disconnected:', socket.id)
      removeSocket(userId, socket.id)
      if (!onlineUsers[userId]) {
        await User.findByIdAndUpdate(userId, { lastSeen: Date.now() })
        socket.broadcast.emit('user:offline', { userId })
      }
    })
  })
  return io
}
exports.get = () => {
  return io
}
