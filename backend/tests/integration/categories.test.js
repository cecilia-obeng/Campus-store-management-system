const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/categories', () => {
  it('returns every category sorted by name, with its product count', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { id: 1, name: 'Drinks', description: null, product_count: 2 },
        { id: 3, name: 'Empty', description: null, product_count: 0 },
        { id: 2, name: 'Snacks', description: null, product_count: 2 },
      ],
    });
  });
});
