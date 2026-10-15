const { AppError } = require('../errors');

// Postgres error codes that mean "the client sent a bad value".
const PG_VALIDATION_CODES = new Set(['23514', '22P02', '22003']);

// Ways an unreachable or lost database shows up: some errors have a code,
// others only a message.
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ECONNRESET',
  'ETIMEDOUT',
  '57P01',
  '57P03',
]);
const CONNECTION_ERROR_MESSAGES = [
  'Connection terminated unexpectedly',
  'timeout exceeded when trying to connect',
];

function isConnectionError(err) {
  if (CONNECTION_ERROR_CODES.has(err.code)) return true;
  const message = err.message || '';
  return CONNECTION_ERROR_MESSAGES.some((text) => message.includes(text));
}

// The only place the { error: { ... } } shape is built.
function send(res, status, code, message, details) {
  const error = { code, message };
  if (Array.isArray(details) && details.length > 0) {
    error.details = details;
  }
  return res.status(status).json({ error });
}

// Express treats a function as an error handler only if it has 4 parameters,
// so `next` must stay even though it is rarely called.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON.');
  }
  if (err.type === 'entity.too.large') {
    return send(res, 400, 'VALIDATION_ERROR', 'Request body is too large.');
  }

  if (err.code === '23505') {
    return send(res, 409, 'DUPLICATE', 'A record with that value already exists.');
  }
  if (err.code === '23001') {
    return send(res, 409, 'IN_USE', 'This record is in use and cannot be deleted.');
  }
  if (err.code === '23503') {
    if (req.method === 'DELETE') {
      return send(res, 409, 'IN_USE', 'This record is in use and cannot be deleted.');
    }
    return send(res, 400, 'VALIDATION_ERROR', 'A referenced record does not exist.');
  }
  if (PG_VALIDATION_CODES.has(err.code)) {
    return send(res, 400, 'VALIDATION_ERROR', 'Request contains an invalid value.');
  }

  if (isConnectionError(err)) {
    console.error('Database unavailable:', err.message);
    return send(res, 503, 'INTERNAL_ERROR', 'Database unavailable. Please try again.');
  }

  console.error(err);
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

module.exports = errorHandler;
