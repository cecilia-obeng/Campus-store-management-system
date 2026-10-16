const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

// Fixture (tests/helpers/resetDb.js): Cola (id 1) 10.00, stock 50; Chips (id 3) 12.50, stock 3.
//   sale 1: Cola  x2  20.00  cash          2026-09-30 23:30 UTC
//   sale 2: Cola  x1  10.00  card          2026-10-01 00:00 UTC
//   sale 3: Chips x1  12.50  mobile_money  2026-10-05 12:00 UTC

// Ids of the sales in a list response, in order.
function ids(res) {
  return res.body.data.map((sale) => sale.id);
}

async function stockOf(productId) {
  const res = await request(app).get(`/api/products/${productId}`);
  return res.body.data.stock_quantity;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/sales: history, filters and pages', () => {
  it('lists every sale, newest first, with names and the total', async () => {
    const res = await request(app).get('/api/sales');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([3, 2, 1]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3 });
    expect(res.body.data[0]).toMatchObject({
      id: 3,
      product_name: 'Chips',
      category_name: 'Snacks',
      quantity: 1,
      unit_price: 12.5,
      total: 12.5,
      payment_method: 'mobile_money',
      sale_date: '2026-10-05T12:00:00.000Z',
    });
  });

  it('includes the whole "to" day, in UTC (T-16)', async () => {
    const lastDayOfSeptember = await request(app).get('/api/sales?from=2026-09-30&to=2026-09-30');
    const firstDayOfOctober = await request(app).get('/api/sales?from=2026-10-01&to=2026-10-01');

    expect(ids(lastDayOfSeptember)).toEqual([1]);
    expect(ids(firstDayOfOctober)).toEqual([2]);
  });

  it('filters by product, category and payment method', async () => {
    const cola = await request(app).get('/api/sales?product_id=1');
    const snacks = await request(app).get('/api/sales?category_id=2');
    const card = await request(app).get('/api/sales?payment_method=card');

    expect(ids(cola)).toEqual([2, 1]);
    expect(ids(snacks)).toEqual([3]);
    expect(snacks.body.meta.total).toBe(1);
    expect(ids(card)).toEqual([2]);
  });

  it('sorts by total, either way', async () => {
    const highest = await request(app).get('/api/sales?sort=-total');
    const lowest = await request(app).get('/api/sales?sort=total');

    expect(ids(highest)).toEqual([1, 3, 2]);
    expect(ids(lowest)).toEqual([2, 3, 1]);
  });

  it('splits the list into pages', async () => {
    const res = await request(app).get('/api/sales?limit=2&page=2');

    expect(ids(res)).toEqual([1]);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3 });
  });

  it('rejects from after to, and a date that does not exist (T-16)', async () => {
    const backwards = await request(app).get('/api/sales?from=2026-12-01&to=2026-11-01');
    const impossible = await request(app).get('/api/sales?from=2026-02-30');

    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details).toEqual([
      { field: 'from', message: 'From date must be on or before the to date.' },
    ]);
    expect(impossible.body.error.details).toEqual([
      { field: 'from', message: 'From date must be a real date written as YYYY-MM-DD.' },
    ]);
  });
});

describe('GET /api/sales/:id', () => {
  it('returns one sale, 404 for an unknown id, 400 for an id that is not a number', async () => {
    const found = await request(app).get('/api/sales/1');
    const missing = await request(app).get('/api/sales/999');
    const notANumber = await request(app).get('/api/sales/abc');

    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ id: 1, product_name: 'Cola', quantity: 2, total: 20 });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({ code: 'NOT_FOUND', message: 'Sale 999 was not found.' });
    expect(notANumber.status).toBe(400);
  });
});

describe('PUT /api/sales/:id: correcting a sale (T-13, T-14)', () => {
  it('correcting the quantity up takes only the difference from stock', async () => {
    const res = await request(app).put('/api/sales/1').send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 1,
      quantity: 5,
      total: 50,
      product_stock_after: 47,
      is_low_stock: false,
    });
    expect(await stockOf(1)).toBe(47);
  });

  it('correcting the quantity down gives the difference back', async () => {
    const res = await request(app).put('/api/sales/1').send({ quantity: 1 });

    expect(res.body.data.quantity).toBe(1);
    expect(res.body.data.total).toBe(10);
    expect(await stockOf(1)).toBe(51);
  });

  it('changing only the payment method or date leaves quantity and stock alone', async () => {
    const payment = await request(app).put('/api/sales/1').send({ payment_method: 'card' });
    const dated = await request(app)
      .put('/api/sales/1')
      .send({ sale_date: '2026-10-02T09:00:00Z' });

    expect(payment.body.data).toMatchObject({ quantity: 2, payment_method: 'card' });
    expect(dated.body.data).toMatchObject({
      quantity: 2,
      payment_method: 'card',
      sale_date: '2026-10-02T09:00:00.000Z',
    });
    expect(await stockOf(1)).toBe(50);
  });

  it('refuses a correction the stock cannot cover: 409, and nothing changes', async () => {
    const res = await request(app).put('/api/sales/3').send({ quantity: 5 });
    const sale = await request(app).get('/api/sales/3');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details[0]).toMatchObject({ available: 3, requested: 4 });
    expect(sale.body.data.quantity).toBe(1);
    expect(await stockOf(3)).toBe(3);
  });

  it('rejects changing the product or the price, and an empty body (T-14)', async () => {
    const product = await request(app).put('/api/sales/1').send({ product_id: 2 });
    const price = await request(app).put('/api/sales/1').send({ unit_price: 0.01 });
    const empty = await request(app).put('/api/sales/1').send({});

    expect(product.status).toBe(400);
    expect(product.body.error.details).toEqual([
      {
        field: 'product_id',
        message: 'Product cannot be changed; cancel the sale and record a new one.',
      },
    ]);
    expect(price.body.error.details[0].field).toBe('unit_price');
    expect(empty.body.error.details).toEqual([
      { field: '', message: 'Send at least one of quantity, payment_method or sale_date.' },
    ]);
  });

  it('returns 404 for a sale that does not exist', async () => {
    const res = await request(app).put('/api/sales/999').send({ quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Sale 999 was not found.');
  });

  it('moves stock by the difference only once, even with 10 corrections at once', async () => {
    // One listening server for all 10 requests, so they really overlap.
    // (request(app) starts a new server per request, which spaces them out.)
    const server = app.listen(0);
    try {
      // Five rounds, 2 -> 5 -> 2 -> 5 -> 2 -> 5: a missing lock can't get lucky five times.
      for (const [quantity, expectedStock] of [[5, 47], [2, 50], [5, 47], [2, 50], [5, 47]]) {
        const results = await Promise.all(
          Array.from({ length: 10 }, () => request(server).put('/api/sales/1').send({ quantity })),
        );

        expect(results.map((res) => res.status)).toEqual(Array(10).fill(200));
        expect(await stockOf(1)).toBe(expectedStock);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('DELETE /api/sales/:id: cancelling a sale (T-15)', () => {
  it('deletes the sale and gives its quantity back; a second cancel is 404', async () => {
    const res = await request(app).delete('/api/sales/1');
    const again = await request(app).delete('/api/sales/1');
    const after = await request(app).get('/api/sales/1');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await stockOf(1)).toBe(52);
    expect(after.status).toBe(404);
    expect(again.status).toBe(404);
    expect(again.body.error.message).toBe('Sale 1 was not found.');
  });
});
