const { VALIDATION, USER_ROLES } = require('../src/constants')
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
  pgm.createType('user_role', Object.values(USER_ROLES))

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    username: {
      type: `varchar(${VALIDATION.USERNAME.MAX_LENGTH})`,
      notNull: true,
      unique: true,
      check: `length(username) >= ${VALIDATION.USERNAME.MIN_LENGTH}`,
    },
    email: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    role: {
      type: 'user_role',
      notNull: true,
      default: USER_ROLES.USER,
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
  pgm.dropTable('users')
  pgm.dropType('user_role')
}
