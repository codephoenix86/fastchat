const { VALIDATION } = require('../src/constants')
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('profiles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    avatar: {
      type: 'text',
    },
    bio: {
      type: 'text',
      check: `length(bio) <= ${VALIDATION.BIO.MAX_LENGTH}`,
    },
    last_seen: {
      type: 'timestamp',
      default: pgm.func('now()'),
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('now()'),
      notNull: true,
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('now()'),
      notNull: true,
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('profiles')
}
