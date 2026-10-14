// Errors that services and controllers throw on purpose.
// Only errorHandler turns them into an HTTP response.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function badRequest(message, details) {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

function notFound(message) {
  return new AppError(404, 'NOT_FOUND', message);
}

function conflict(code, message, details) {
  return new AppError(409, code, message, details);
}

module.exports = {
  AppError,
  badRequest,
  notFound,
  conflict,
};
