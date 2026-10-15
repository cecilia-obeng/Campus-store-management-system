const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

// Fixture (tests/helpers/resetDb.js): 1 Cola, 2 Water, 3 Chips, 4 Gum.
// Water (10/10) and Chips (3/5) are low on stock; Cola has 2 sales, Gum none.

// Names of the products in a list response, in order.
function names(res) {
  return res.body.data.map((product) => product.name);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/products: filtering and pagination', () => {
  it('lists every product sorted by name, with numbers as numbers', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Chips', 'Cola', 'Gum', 'Water']);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4 });
    expect(res.body.data[0]).toMatchObject({
      name: 'Chips',
      category_name: 'Snacks',
      price: 12.5,
      is_low_stock: true,
    });
  });

  it('searches names case-insensitively', async () => {
    const res = await request(app).get('/api/products?search=COL');

    expect(names(res)).toEqual(['Cola']);
    expect(res.body.meta.total).toBe(1);
  });

  it('treats % and _ in a search as plain characters', async () => {
    const percent = await request(app).get('/api/products?search=%25');
    const underscore = await request(app).get('/api/products?search=_');

    expect(percent.body.meta.total).toBe(0);
    expect(underscore.body.meta.total).toBe(0);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/products?category_id=2');

    expect(names(res)).toEqual(['Chips', 'Gum']);
  });

  it('filters by low stock, counting stock equal to the reorder level as low', async () => {
    const low = await request(app).get('/api/products?low_stock=true');
    const notLow = await request(app).get('/api/products?low_stock=false');

    expect(names(low)).toEqual(['Chips', 'Water']);
    expect(names(notLow)).toEqual(['Cola', 'Gum']);
  });

  it('combines search, category, low stock and sort', async () => {
    const drinks = await request(app).get('/api/products?search=a&category_id=1&sort=-price');
    const lowDrinks = await request(app).get(
      '/api/products?search=a&category_id=1&low_stock=true&sort=-price',
    );

    expect(names(drinks)).toEqual(['Cola', 'Water']);
    expect(names(lowDrinks)).toEqual(['Water']);
  });

  it('sorts by price, highest first', async () => {
    const res = await request(app).get('/api/products?sort=-price');

    expect(names(res)).toEqual(['Chips', 'Cola', 'Water', 'Gum']);
  });

  it('splits the list into pages that do not overlap', async () => {
    const page1 = await request(app).get('/api/products?limit=3&page=1');
    const page2 = await request(app).get('/api/products?limit=3&page=2');

    expect(names(page1)).toEqual(['Chips', 'Cola', 'Gum']);
    expect(names(page2)).toEqual(['Water']);
    expect(page2.body.meta).toEqual({ page: 2, limit: 3, total: 4 });
  });

  it('rejects invalid query parameters with 400', async () => {
    const res = await request(app).get('/api/products?sort=bogus&limit=101');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(['sort', 'limit']);
  });
});
