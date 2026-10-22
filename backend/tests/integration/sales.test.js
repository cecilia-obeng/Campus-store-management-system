const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

// Fixture (tests/helpers/resetDb.js): 1 Cola 10.00 (stock 50, level 10),
// 3 Chips 12.50 (stock 3, level 5). Sales 1-3 exist, so the next sale is id 4.

const SALE = { product_id: 1, quantity: 2, payment_method: 'cash' };

// The product's stock, read through the API (the side effect a sale must have).
async function stockOf(productId) {
  const res = await request(app).get(`/api/products/${productId}`);
  return res.body.data.stock_quantity;
}

// Rows in the sales table, read straight from the database.
async function salesCount() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM sales');
  return rows[0].count;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('POST /api/sales: recording a sale', () => {
  it('records a sale: 201, Location header, price copied, stock taken', async () => {
    const res = await request(app).post('/api/sales').send(SALE);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/sales/4');
    expect(res.body.data).toMatchObject({
      id: 4,
      product_id: 1,
      product_name: 'Cola',
      category_name: 'Drinks',
      quantity: 2,
      unit_price: 10,
      total: 20,
      payment_method: 'cash',
      product_stock_after: 48,
      is_low_stock: false,
    });
    expect(await stockOf(1)).toBe(48);
  });

  it('ignores a unit_price and total sent by the client (T-09)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, unit_price: 0.01, total: 0.02 });

    expect(res.status).toBe(201);
    expect(res.body.data.unit_price).toBe(10);
    expect(res.body.data.total).toBe(20);
    const { rows } = await db.query('SELECT unit_price FROM sales WHERE id = 4');
    expect(rows[0].unit_price).toBe('10.00');
    expect(await stockOf(1)).toBe(48);
  });

  it('uses the sale_date sent, or now when there is none', async () => {
    const dated = await request(app)
      .post('/api/sales')
      .send({ ...SALE, sale_date: '2026-10-13T11:05:00Z' });
    const undated = await request(app).post('/api/sales').send(SALE);

    expect(dated.body.data.sale_date).toBe('2026-10-13T11:05:00.000Z');
    expect(undated.body.data.sale_date).toBe(undated.body.data.created_at);
  });

  it('flags low stock when a sale brings stock down to the reorder level', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, quantity: 40 });

    expect(res.body.data.product_stock_after).toBe(10);
    expect(res.body.data.is_low_stock).toBe(true);
  });

  it('can sell the last units exactly', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, product_id: 3, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.product_stock_after).toBe(0);
  });
});

describe('overselling and missing products (T-10)', () => {
  it('refuses to sell more than the stock: 409, and nothing changes', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, product_id: 3, quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INSUFFICIENT_STOCK',
      message: "Only 3 units of 'Chips' in stock; cannot sell 5.",
      details: [
        { field: 'quantity', message: 'Only 3 available.', available: 3, requested: 5 },
      ],
    });
    expect(await stockOf(3)).toBe(3);
    expect(await salesCount()).toBe(3);
  });

  it('uses the singular when only 1 unit is left', async () => {
    await request(app)
      .post('/api/sales')
      .send({ ...SALE, product_id: 3, quantity: 2 });
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, product_id: 3, quantity: 2 });

    expect(res.body.error.message).toBe("Only 1 unit of 'Chips' in stock; cannot sell 2.");
  });

  it('returns 404 for a product that does not exist, and saves nothing', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, product_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Product 999 was not found.' });
    expect(await salesCount()).toBe(3);
  });
});

describe('validation (T-12)', () => {
  it('rejects an unknown payment method', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ ...SALE, payment_method: 'bitcoin' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      {
        field: 'payment_method',
        message: 'Payment method must be one of: cash, mobile_money, card.',
      },
    ]);
  });

  it('rejects a sale_date in the future, or without a time zone', async () => {
    const future = await request(app)
      .post('/api/sales')
      .send({ ...SALE, sale_date: '2099-01-01T00:00:00Z' });
    const noZone = await request(app)
      .post('/api/sales')
      .send({ ...SALE, sale_date: '2026-10-12T11:05' });

    expect(future.body.error.details).toEqual([
      { field: 'sale_date', message: 'Sale date cannot be in the future.' },
    ]);
    expect(noZone.body.error.details[0].field).toBe('sale_date');
  });

  it('rejects a quantity that is not a whole number from 1 to 10,000', async () => {
    for (const quantity of [0, 1.5, '2', 10001]) {
      const res = await request(app)
        .post('/api/sales')
        .send({ ...SALE, quantity });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { field: 'quantity', message: 'Quantity must be a whole number from 1 to 10,000.' },
      ]);
    }
  });

  it('lists every missing field when the body is empty', async () => {
    const res = await request(app).post('/api/sales').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail) => detail.message)).toEqual([
      'Product is required.',
      'Quantity is required.',
      'Payment method is required.',
    ]);
  });
});

describe('concurrent sales (T-11)', () => {
  it('never oversells: 10 sales at once against stock 3 give exactly 3 successes', async () => {
    const sale = { product_id: 3, quantity: 1, payment_method: 'cash' };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app).post('/api/sales').send(sale)),
    );
    const statuses = results.map((res) => res.status).sort();

    expect(statuses).toEqual([201, 201, 201, 409, 409, 409, 409, 409, 409, 409]);
    expect(await stockOf(3)).toBe(0);
    expect(await salesCount()).toBe(3 + 3);
  });
});
