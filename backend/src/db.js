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

// withTransaction: added in L04

module.exports = {
  pool,
  query,
  ping,
};
