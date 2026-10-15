const db = require('../db');

// "Database down" is a normal answer for a health check, not a failure,
// so this controller handles the error itself instead of passing it on.
async function check(req, res) {
  try {
    await db.ping();
    res.status(200).json({ status: 'ok', database: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
}

module.exports = { check };
