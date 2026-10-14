const app = require('./app');
const config = require('./config');
const { pool } = require('./db');

const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

let shuttingDown = false;

// Stop taking new requests, let in-flight ones finish, then close the DB pool.
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  // If something hangs, force the exit after 10 s.
  setTimeout(() => {
    console.error('Shutdown took too long, forcing exit.');
    process.exit(1);
  }, 10_000).unref();

  server.close(() => {
    pool
      .end()
      .then(() => {
        console.log('Shutdown complete.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing the database pool:', err);
        process.exit(1);
      });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
