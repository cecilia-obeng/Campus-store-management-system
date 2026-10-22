const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const config = require('./config');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// The API contract, read once at start-up. backend/openapi.yaml is a copy of
// dev_docs/openapi.yaml because the backend container only sees ./backend;
// tests/unit/openapi.test.js fails if the two copies drift apart.
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));

// Builds the Express app. It does not listen on a port; server.js does that,
// so tests can import the app without opening one.
const app = express();

// Logger goes first so requests that fail later (bad JSON, too large) are still logged.
if (config.requestLogging) {
  app.use(requestLogger);
}
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: config.corsOrigins }));
app.use('/api', routes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Must come after every route, and errorHandler must be last.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
