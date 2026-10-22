const fs = require('fs');
const path = require('path');
const request = require('supertest');
const YAML = require('yaml');
const app = require('../../src/app');
const db = require('../../src/db');
const routes = require('../../src/routes');

// No resetDb here: the docs page reads no tables.

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/docs (Swagger UI)', () => {
  it('serves the Swagger UI page', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('redirects /api/docs to /api/docs/, so the page finds its files', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/api/docs/');
  });

  it('loads our openapi.yaml into the page', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-init.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Campus Store Sales Tracker API');
    expect(res.text).toContain('/summary/daily');
  });

  it('leaves other unknown routes to the JSON 404', async () => {
    const res = await request(app).get('/api/docsx');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('openapi.yaml and the real routes', () => {
  it('documents every route Express has, and nothing more', () => {
    const spec = YAML.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'openapi.yaml'), 'utf8'));

    // "GET /products/:id" for every route in src/routes/index.js ...
    const inExpress = routes.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`),
      );
    // ... and the same from the spec, where the path says "/products/{id}".
    const inSpec = Object.entries(spec.paths).flatMap(([specPath, operations]) =>
      ['get', 'post', 'put', 'delete']
        .filter((method) => operations[method])
        .map((method) => `${method.toUpperCase()} ${specPath.replace(/\{(\w+)\}/g, ':$1')}`),
    );

    expect(inSpec.sort()).toEqual(inExpress.sort());
  });
});
