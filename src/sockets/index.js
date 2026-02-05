/**
 * Socket module barrel export
 * Main entry point for socket-related functionality
 */
module.exports = {
  socketServer: require('./setup'),
  onlineUsersService: require('./services/online-users.service'),
  SOCKET_EVENTS: require('./events'),
}
