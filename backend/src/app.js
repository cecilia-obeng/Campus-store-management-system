const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// Builds the Express app. It does not listen on a port; server.js does that,
// so tests can import the app without opening one.
const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: config.corsOrigins }));
if (config.requestLogging) {
  app.use(requestLogger);
}

app.use('/api', routes);

// Must come after every route, and errorHandler must be last.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
