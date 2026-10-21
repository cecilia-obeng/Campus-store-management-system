const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { resetDb } = require('../helpers/resetDb');

// Fixture (tests/helpers/resetDb.js), worked out by hand:
//   sale 1: Cola  x2  20.00  2026-09-30 23:30 UTC
//   sale 2: Cola  x1  10.00  2026-10-01 00:00 UTC
//   sale 3: Chips x1  12.50  2026-10-05 12:00 UTC
//   revenue 42.50 · orders 3 · AOV 42.50 / 3 = 14.1666… → 14.17 · units 4
//   low stock now: Water (10 <= 10) and Chips (3 <= 5) → 2

// A new product (Drinks, stock 50, so never low) with one sale of 1 unit.
async function sellNewProduct(name, price, saleDate) {
  const product = await request(app)
    .post('/api/products')
    .send({ name, category_id: 1, price, stock_quantity: 50 });
  await request(app)
    .post('/api/sales')
    .send({ product_id: product.body.data.id, quantity: 1, payment_method: 'cash', sale_date: saleDate });
}

// Names in top_products, in order.
function topNames(res) {
  return res.body.data.top_products.map((product) => product.product_name);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/summary', () => {
  it('equals the hand-calculated totals for all time (T-17)', async () => {
    const res = await request(app).get('/api/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      period: { from: null, to: null },
      total_revenue: 42.5,
      total_orders: 3,
      average_order_value: 14.17,
      total_units_sold: 4,
      low_stock_count: 2,
      top_products: [
        { product_id: 1, product_name: 'Cola', category_name: 'Drinks', units_sold: 3, revenue: 30 },
        { product_id: 3, product_name: 'Chips', category_name: 'Snacks', units_sold: 1, revenue: 12.5 },
      ],
    });
  });

  it('counts whole UTC days, like the sales list', async () => {
    const lastDayOfSeptember = await request(app).get('/api/summary?from=2026-09-30&to=2026-09-30');
    const october = await request(app).get('/api/summary?from=2026-10-01');

    expect(lastDayOfSeptember.body.data).toMatchObject({
      period: { from: '2026-09-30', to: '2026-09-30' },
      total_revenue: 20,
      total_orders: 1,
      total_units_sold: 2,
    });
    expect(october.body.data).toMatchObject({
      period: { from: '2026-10-01', to: null },
      total_revenue: 22.5,
      total_orders: 2,
      average_order_value: 11.25,
    });
  });

  it('gives zeros, AOV 0 and no top products for an empty period (T-18)', async () => {
    const res = await request(app).get('/api/summary?from=2000-01-01&to=2000-01-31');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total_revenue: 0,
      total_orders: 0,
      average_order_value: 0,
      total_units_sold: 0,
      top_products: [],
    });
  });

  it('counts low stock now, whatever the period', async () => {
    const res = await request(app).get('/api/summary?from=2000-01-01&to=2000-01-31');

    expect(res.body.data.low_stock_count).toBe(2);
  });

  it('breaks a revenue tie by product name, A to Z', async () => {
    // Apple Juice (id 5) and Cola (id 1) both take 10.00 on 1 October.
    await sellNewProduct('Apple Juice', 10, '2026-10-01T12:00:00Z');

    const res = await request(app).get('/api/summary?from=2026-10-01&to=2026-10-01');

    expect(topNames(res)).toEqual(['Apple Juice', 'Cola']);
    expect(res.body.data.top_products.map((product) => product.revenue)).toEqual([10, 10]);
  });

  it('lists at most 5 products, highest revenue first', async () => {
    // With Cola 30.00 and Chips 12.50, six products have sales.
    await sellNewProduct('Tea', 5, '2026-10-02T09:00:00Z');
    await sellNewProduct('Juice', 4, '2026-10-02T09:00:00Z');
    await sellNewProduct('Mints', 3, '2026-10-02T09:00:00Z');
    await sellNewProduct('Pen', 1, '2026-10-02T09:00:00Z');

    const res = await request(app).get('/api/summary');

    expect(topNames(res)).toEqual(['Cola', 'Chips', 'Tea', 'Juice', 'Mints']);
  });

  it('includes a sale as soon as it is recorded', async () => {
    await request(app)
      .post('/api/sales')
      .send({ product_id: 3, quantity: 2, payment_method: 'card', sale_date: '2026-10-05T13:00:00Z' });

    const res = await request(app).get('/api/summary');

    expect(res.body.data).toMatchObject({
      total_revenue: 67.5,
      total_orders: 4,
      average_order_value: 16.88,
      total_units_sold: 6,
    });
    expect(topNames(res)).toEqual(['Chips', 'Cola']);
  });

  it('rejects a from date after the to date, and a date that does not exist', async () => {
    const backwards = await request(app).get('/api/summary?from=2026-10-10&to=2026-10-01');
    const notReal = await request(app).get('/api/summary?to=2026-02-30');

    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details).toEqual([
      { field: 'from', message: 'From date must be on or before the to date.' },
    ]);
    expect(notReal.status).toBe(400);
    expect(notReal.body.error.details).toEqual([
      { field: 'to', message: 'To date must be a real date written as YYYY-MM-DD.' },
    ]);
  });
});

describe('GET /api/summary/daily', () => {
  // "Today" is 6 October 2026 (only Date is faked, so pg and timers still work).
  // The default 7 days are then 30 Sep to 6 Oct, which holds all three fixture sales.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives 7 days by default, oldest first, ending today, zero days included', async () => {
    const res = await request(app).get('/api/summary/daily');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { date: '2026-09-30', revenue: 20, orders: 1 },
      { date: '2026-10-01', revenue: 10, orders: 1 },
      { date: '2026-10-02', revenue: 0, orders: 0 },
      { date: '2026-10-03', revenue: 0, orders: 0 },
      { date: '2026-10-04', revenue: 0, orders: 0 },
      { date: '2026-10-05', revenue: 12.5, orders: 1 },
      { date: '2026-10-06', revenue: 0, orders: 0 },
    ]);
  });

  it('accepts 1 to 90 days', async () => {
    const one = await request(app).get('/api/summary/daily?days=1');
    const ninety = await request(app).get('/api/summary/daily?days=90');
    const dates = ninety.body.data.map((day) => day.date);
    const revenue = ninety.body.data.reduce((sum, day) => sum + day.revenue, 0);

    expect(one.body.data).toEqual([{ date: '2026-10-06', revenue: 0, orders: 0 }]);
    expect(ninety.status).toBe(200);
    expect(dates).toHaveLength(90);
    expect(dates[0]).toBe('2026-07-09');
    expect(dates[89]).toBe('2026-10-06');
    expect(revenue).toBe(42.5);
  });

  it('adds up to the same totals as GET /api/summary for the same days', async () => {
    const daily = await request(app).get('/api/summary/daily');
    const summary = await request(app).get('/api/summary?from=2026-09-30&to=2026-10-06');
    const days = daily.body.data;

    expect(days.reduce((sum, day) => sum + day.revenue, 0)).toBe(summary.body.data.total_revenue);
    expect(days.reduce((sum, day) => sum + day.orders, 0)).toBe(summary.body.data.total_orders);
  });

  it('shows a sale today as soon as it is recorded, and drops it when cancelled', async () => {
    const sale = await request(app)
      .post('/api/sales')
      .send({ product_id: 1, quantity: 3, payment_method: 'cash', sale_date: '2026-10-06T09:00:00Z' });

    const afterSale = await request(app).get('/api/summary/daily?days=1');
    await request(app).delete(`/api/sales/${sale.body.data.id}`);
    const afterCancel = await request(app).get('/api/summary/daily?days=1');

    expect(sale.status).toBe(201);
    expect(afterSale.body.data).toEqual([{ date: '2026-10-06', revenue: 30, orders: 1 }]);
    expect(afterCancel.body.data).toEqual([{ date: '2026-10-06', revenue: 0, orders: 0 }]);
  });

  it.each([
    ['0', 'Days must be at least 1.'],
    ['91', 'Days must be at most 90.'],
    ['abc', 'Days must be a whole number.'],
    ['2.5', 'Days must be a whole number.'],
    ['', 'Days must be a whole number.'],
  ])('rejects days=%s', async (days, message) => {
    const res = await request(app).get(`/api/summary/daily?days=${days}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'days', message }]);
  });
});
