const { idParam, queryDate, saleDate } = require('../../src/validation/common');
const { listProductsQuery, productBody } = require('../../src/validation/products.schema');
const {
  createSaleBody,
  listSalesQuery,
  updateSaleBody,
} = require('../../src/validation/sales.schema');

// Unit tests for the zod schemas: safeParse never throws, it returns
// { success, data } or { success, error }. No database, no HTTP.

// The messages of a failed parse, so a test can check the exact wording.
function messages(result) {
  return result.error.issues.map((issue) => issue.message);
}

describe('idParam (every /:id route)', () => {
  it('accepts a whole number and converts it from text', () => {
    expect(idParam.safeParse({ id: '42' }).data).toEqual({ id: 42 });
  });

  it.each(['', 'abc', '2.5', '-1', '0'])('rejects %j', (id) => {
    expect(idParam.safeParse({ id }).success).toBe(false);
  });
});

describe('listProductsQuery', () => {
  it('fills in the defaults: sort by name, page 1, 20 per page', () => {
    expect(listProductsQuery.safeParse({}).data).toEqual({ sort: 'name', page: 1, limit: 20 });
  });

  it('turns low_stock text into a boolean and trims the search', () => {
    const { data } = listProductsQuery.safeParse({ low_stock: 'false', search: '  usb ' });

    expect(data.low_stock).toBe(false);
    expect(data.search).toBe('usb');
  });

  it('rejects a sort that is not on the whitelist, and a limit over 100', () => {
    expect(listProductsQuery.safeParse({ sort: 'price; DROP TABLE products' }).success).toBe(false);
    expect(listProductsQuery.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('productBody', () => {
  const valid = { name: '  Cola  ', category_id: 1, price: 10, stock_quantity: 5 };

  it('trims the name and defaults reorder_level to 10', () => {
    const { data } = productBody.safeParse(valid);

    expect(data.name).toBe('Cola');
    expect(data.reorder_level).toBe(10);
  });

  it('accepts 2 decimal places and rejects 3', () => {
    expect(productBody.safeParse({ ...valid, price: 4.35 }).success).toBe(true);

    const result = productBody.safeParse({ ...valid, price: 4.355 });
    expect(messages(result)).toEqual(['Price can have at most 2 decimal places.']);
  });

  it('says "is required" for a missing field and "must be a number" for text', () => {
    expect(messages(productBody.safeParse({ ...valid, price: undefined }))).toEqual([
      'Price is required.',
    ]);
    expect(messages(productBody.safeParse({ ...valid, price: '10' }))).toEqual([
      'Price must be a number.',
    ]);
  });

  it('strips fields it does not know', () => {
    const { data } = productBody.safeParse({ ...valid, id: 99, is_low_stock: true });

    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('is_low_stock');
  });
});

describe('queryDate', () => {
  const from = queryDate('From date');

  it('accepts a real date, including 29 February in a leap year', () => {
    expect(from.safeParse('2026-10-13').success).toBe(true);
    expect(from.safeParse('2028-02-29').success).toBe(true);
  });

  it.each(['2026-02-30', '2026-02-29', '13/10/2026', '2026-1-5', ''])('rejects %j', (value) => {
    expect(from.safeParse(value).success).toBe(false);
  });
});

describe('saleDate', () => {
  it('accepts a past date-time with a time zone', () => {
    expect(saleDate.safeParse('2026-10-01T09:00:00Z').success).toBe(true);
  });

  it('rejects a date-time without a time zone, and one in the future', () => {
    expect(saleDate.safeParse('2026-10-01T09:00:00').success).toBe(false);

    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(messages(saleDate.safeParse(nextYear))).toEqual(['Sale date cannot be in the future.']);
  });
});

describe('createSaleBody', () => {
  it('strips unit_price and total, so the client can never set the price', () => {
    const { data } = createSaleBody.safeParse({
      product_id: 1,
      quantity: 2,
      payment_method: 'cash',
      unit_price: 0.01,
      total: 0.02,
    });

    expect(data).toEqual({ product_id: 1, quantity: 2, payment_method: 'cash' });
  });

  it('rejects quantity 0 and an unknown payment method, one message each', () => {
    const result = createSaleBody.safeParse({ product_id: 1, quantity: 0, payment_method: 'bitcoin' });

    expect(messages(result)).toEqual([
      'Quantity must be a whole number from 1 to 10,000.',
      'Payment method must be one of: cash, mobile_money, card.',
    ]);
  });
});

describe('listSalesQuery', () => {
  it('defaults to newest first', () => {
    expect(listSalesQuery.safeParse({}).data.sort).toBe('-sale_date');
  });

  it('allows from equal to to, and rejects from after to', () => {
    expect(listSalesQuery.safeParse({ from: '2026-10-01', to: '2026-10-01' }).success).toBe(true);
    expect(messages(listSalesQuery.safeParse({ from: '2026-10-02', to: '2026-10-01' }))).toEqual([
      'From date must be on or before the to date.',
    ]);
  });
});

describe('updateSaleBody', () => {
  it('accepts a single field', () => {
    expect(updateSaleBody.safeParse({ quantity: 5 }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(messages(updateSaleBody.safeParse({}))).toEqual([
      'Send at least one of quantity, payment_method or sale_date.',
    ]);
  });

  it('rejects changing the product or the price', () => {
    expect(messages(updateSaleBody.safeParse({ product_id: 3 }))).toEqual([
      'Product cannot be changed; cancel the sale and record a new one.',
    ]);
    expect(messages(updateSaleBody.safeParse({ unit_price: 1 }))).toEqual([
      'Unit price cannot be changed; it is copied when the sale is recorded.',
    ]);
  });
});
