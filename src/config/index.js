/**
 * Configuration barrel export
 * Centralizes all configuration modules
 */
module.exports = {
  env: require('./env'),
  logger: require('./logger'),
  mongo: require('./mongodb'),
  postgres: require('./postgresql'),
  redis: require('./redis'),
}
