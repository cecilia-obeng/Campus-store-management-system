const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');

// No resetDb here: these tests read no tables, so they don't need the fixture.
// "Database down" is simulated with vi.spyOn, so Postgres keeps running for
// the other test files.

afterEach(() => {
  // Undo every spy, so a fake failure never leaks into the next test.
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/health (T-21)', () => {
  it('returns 200 when the database answers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('returns 503 when the database does not answer', async () => {
    vi.spyOn(db, 'ping').mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    // healthController logs the failure; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', database: 'unreachable' });
  });

  it('stays up: the next request after a failure is answered normally', async () => {
    vi.spyOn(db, 'ping').mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const down = await request(app).get('/api/health');
    const up = await request(app).get('/api/health');

    expect(down.status).toBe(503);
    expect(up.status).toBe(200);
  });
});

describe('database unavailable on a normal route (T-21)', () => {
  it('answers 503 in the standard error shape instead of crashing', async () => {
    const lost = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    vi.spyOn(db, 'query').mockRejectedValueOnce(lost);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Database unavailable. Please try again.' },
    });
  });
});

describe('unknown routes (T-20)', () => {
  it('answers a JSON 404 ROUTE_NOT_FOUND, not an HTML page', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'GET /api/nope does not exist.' },
    });
  });

  it('names the method and leaves the query string out of the message', async () => {
    const res = await request(app).delete('/api/categories?force=true');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('DELETE /api/categories does not exist.');
  });
});
