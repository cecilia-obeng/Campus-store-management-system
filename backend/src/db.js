const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 2000,
});

// An idle connection can fail without a query being active.
// Log the error; do not terminate the API process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

function query(text, params) {
  return pool.query(text, params);
}

async function ping() {
  await pool.query({ text: 'SELECT 1', query_timeout: 2000 });
}

// Runs fn(client) inside one transaction on one connection.
// COMMIT if fn succeeds; ROLLBACK and rethrow if anything throws.
// readOnly is for reports (CS-60): every query sees the same snapshot.
async function withTransaction(fn, { readOnly = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // If the rollback fails too, the original error is the one that matters.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  ping,
  withTransaction,
};
