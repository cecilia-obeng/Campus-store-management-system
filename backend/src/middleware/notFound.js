const { AppError } = require('../errors');

// Reached only when no route matched the request.
// Passes a 404 to errorHandler, so one file builds every error response.
function notFound(req, res, next) {
  const path = req.originalUrl.split('?')[0];
  next(new AppError(404, 'ROUTE_NOT_FOUND', `${req.method} ${path} does not exist.`));
}

module.exports = notFound;
