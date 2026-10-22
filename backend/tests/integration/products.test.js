const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

// Fixture (tests/helpers/resetDb.js): 1 Cola, 2 Water, 3 Chips, 4 Gum.
// Water (10/10) and Chips (3/5) are low on stock; Cola has 2 sales, Gum none.


const PEN = { name: 'Pilot Pen Blue', category_id: 2, price: 4.5, stock_quantity: 120 };



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

  it('filters by low stock, counting stock equal to the reorder level as low (T-19)', async () => {
    const low = await request(app).get('/api/products?low_stock=true');
    const notLow = await request(app).get('/api/products?low_stock=false');

    expect(names(low)).toEqual(['Chips', 'Water']);
    expect(names(notLow)).toEqual(['Cola', 'Gum']);
  });

  it('combines search, category, low stock and sort (T-06)', async () => {
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

describe('create, get, update and delete', () => {
  it('creates a product: 201, Location header, trimmed name, default reorder level (T-01)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...PEN, name: '  Pilot Pen Blue  ', unknown_field: true });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/products/5');
    expect(res.body.data).toMatchObject({
      id: 5,
      name: 'Pilot Pen Blue',
      category_name: 'Snacks',
      price: 4.5,
      reorder_level: 10,
      is_low_stock: false,
    });
    expect(res.body.data).not.toHaveProperty('unknown_field');
  });

  it('gets one product by id', async () => {
    const res = await request(app).get('/api/products/2');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 2, name: 'Water', price: 5, is_low_stock: true });
  });

  it('returns 404 for a product that does not exist, and 400 for an id that is not a number (T-20)', async () => {
    const missing = await request(app).get('/api/products/999');
    const notANumber = await request(app).get('/api/products/abc');

    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({ code: 'NOT_FOUND', message: 'Product 999 was not found.' });
    expect(notANumber.status).toBe(400);
    expect(notANumber.body.error.details).toEqual([
      { field: 'id', message: 'Id must be a whole number.' },
    ]);
  });

  it('updates a product as a full replacement (a missing reorder_level goes back to 10)', async () => {
    const res = await request(app)
      .put('/api/products/3')
      .send({ name: 'Chips XL', category_id: 2, price: 13, stock_quantity: 40 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 3,
      name: 'Chips XL',
      price: 13,
      stock_quantity: 40,
      reorder_level: 10,
      is_low_stock: false,
    });
  });

  it('moves updated_at forward on update (the database trigger)', async () => {
    const before = await request(app).get('/api/products/1');
    const res = await request(app)
      .put('/api/products/1')
      .send({ name: 'Cola', category_id: 1, price: 11, stock_quantity: 50 });

    // The fixture's timestamps are 2026-01-01, so any real "now" is later.
    expect(before.body.data.updated_at).toBe('2026-01-01T00:00:00.000Z');
    expect(res.body.data.updated_at > '2026-01-01T00:00:00.000Z').toBe(true);
    expect(res.body.data.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps the unit_price of past sales when the product price changes (T-05)', async () => {
    await request(app)
      .put('/api/products/1')
      .send({ name: 'Cola', category_id: 1, price: 99, stock_quantity: 50 });

    const { rows } = await db.query('SELECT DISTINCT unit_price FROM sales WHERE product_id = 1');
    expect(rows).toEqual([{ unit_price: '10.00' }]);
  });

  it('returns 404 when updating a product that does not exist', async () => {
    const res = await request(app).put('/api/products/999').send(PEN);

    expect(res.status).toBe(404);
  });

  it('marks a product low on stock when stock equals the reorder level (T-19)', async () => {
    const res = await request(app)
      .put('/api/products/1')
      .send({ name: 'Cola', category_id: 1, price: 10, stock_quantity: 10, reorder_level: 10 });

    expect(res.body.data.is_low_stock).toBe(true);
  });

  it('deletes a product that was never sold: 204, then 404 (T-08)', async () => {
    const res = await request(app).delete('/api/products/4');
    const after = await request(app).get('/api/products/4');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(after.status).toBe(404);
  });
});

describe('invalid category and validation errors', () => {
  it('rejects a category that does not exist, on the category_id field (T-04)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...PEN, category_id: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Category 999 does not exist.',
      details: [{ field: 'category_id', message: 'Category 999 does not exist.' }],
    });
  });

  it('also checks the category on update', async () => {
    const res = await request(app)
      .put('/api/products/1')
      .send({ ...PEN, category_id: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('category_id');
  });

  it('reports every invalid field at once (T-03)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'X', category_id: 1, price: -1, stock_quantity: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Request body is invalid.');
    expect(res.body.error.details).toEqual([
      { field: 'name', message: 'Name must be 2 to 100 characters.' },
      { field: 'price', message: 'Price must be 0 or more.' },
      { field: 'stock_quantity', message: 'Stock quantity must be a whole number, 0 or more.' },
    ]);
  });

  it('lists every missing field when the body is empty', async () => {
    const res = await request(app).post('/api/products').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail) => detail.message)).toEqual([
      'Name is required.',
      'Category is required.',
      'Price is required.',
      'Stock quantity is required.',
    ]);
  });

  it('rejects a price with more than 2 decimals, and a price sent as text', async () => {
    const decimals = await request(app)
      .post('/api/products')
      .send({ ...PEN, price: 4.555 });
    const text = await request(app)
      .post('/api/products')
      .send({ ...PEN, price: '5' });

    expect(decimals.body.error.details).toEqual([
      { field: 'price', message: 'Price can have at most 2 decimal places.' },
    ]);
    expect(text.body.error.details).toEqual([{ field: 'price', message: 'Price must be a number.' }]);
  });

  it('answers broken JSON with 400 INVALID_JSON (T-20)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send('{"bad');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('duplicate names', () => {
  it('refuses a name that already exists in a different case: 409 DUPLICATE (T-02)', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...PEN, name: 'cOLA' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'DUPLICATE',
      message: "A product named 'cOLA' already exists.",
    });
  });

  it('refuses to rename a product to an existing name', async () => {
    const res = await request(app)
      .put('/api/products/2')
      .send({ ...PEN, name: 'COLA' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });
});

describe('deleting a product that has sales (T-07)', () => {
  it('refuses with 409 IN_USE and the number of sales, and keeps the product', async () => {
    const res = await request(app).delete('/api/products/1');
    const after = await request(app).get('/api/products/1');

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'IN_USE',
      message: 'Product 1 has 2 sales and cannot be deleted.',
    });
    expect(after.status).toBe(200);
  });

  it('uses the singular for a single sale', async () => {
    const res = await request(app).delete('/api/products/3');

    expect(res.body.error.message).toBe('Product 3 has 1 sale and cannot be deleted.');
  });
});


