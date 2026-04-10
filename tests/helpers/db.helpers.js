const { postgres, redis, mongo } = require('@config')
const { mongoose } = mongo

const connectTestDB = async () => {
  const pool = postgres.getPool()
  const client = redis.getClient()
  await Promise.all([pool.query('SELECT 1'), client.ping(), mongo.connect()])
}
const clearTestDB = async () => {
  const pool = postgres.getPool()
  const client = redis.getClient()
  const statement = `
    DO $$ DECLARE
        r RECORD;
    BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
  `
  const collections = mongoose.connection.collections
  const promises = Object.values(collections).map((collection) => collection.deleteMany({}))
  await Promise.all([...promises, pool.query(statement), client.flushall()])
}

const disconnectTestDB = async () => {
  const pool = postgres.getPool()
  const client = redis.getClient()
  await Promise.all([pool.end(), client.disconnect(), mongo.disconnect()])
}

module.exports = { connectTestDB, clearTestDB, disconnectTestDB }
