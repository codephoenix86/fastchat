/**
 * Configuration barrel export
 * Centralizes all configuration modules
 */
module.exports = {
  env: require('@config/env'),
  db: require('@config/db'),
  logger: require('@config/logger'),
}
