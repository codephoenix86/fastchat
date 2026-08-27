exports.shorthands = undefined

exports.up = (pgm) => {
  // ⚠️ THIS is the correct way to disable the transaction wrapper
  pgm.noTransaction()

  pgm.createIndex('users', 'created_at', {
    name: 'users_created_at_idx',
    concurrently: true,
    method: 'btree',
  })
}

exports.down = (pgm) => {
  // Must also disable it for the rollback!
  pgm.noTransaction()

  pgm.dropIndex('users', 'created_at', {
    name: 'users_created_at_idx',
    concurrently: true,
  })
}
