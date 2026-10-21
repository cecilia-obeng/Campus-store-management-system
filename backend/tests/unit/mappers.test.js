const { toNumber, isLowStock, toCategory, toProduct, toSale } = require('../../src/mappers');

// Unit tests: plain functions in, plain values out. No database, no HTTP.

describe('toNumber', () => {
  it('turns the text pg returns for NUMERIC into a number', () => {
    expect(toNumber('75.00')).toBe(75);
    expect(toNumber('4.35')).toBe(4.35);
  });

  it('keeps null and undefined as null', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe('isLowStock (D-01: at or below the reorder level)', () => {
  it('is true below the level and exactly at it', () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
  });

  it('is false above the level', () => {
    expect(isLowStock(11, 10)).toBe(false);
  });

  it('treats 0 stock with level 0 as low', () => {
    expect(isLowStock(0, 0)).toBe(true);
  });
});

describe('toCategory', () => {
  it('keeps only the contract fields', () => {
    const row = { id: 1, name: 'Drinks', description: null, product_count: 2, created_at: 'x' };

    expect(toCategory(row)).toEqual({ id: 1, name: 'Drinks', description: null, product_count: 2 });
  });
});

describe('toProduct', () => {
  const row = {
    id: 7,
    name: 'Cola',
    category_id: 1,
    category_name: 'Drinks',
    price: '10.00',
    stock_quantity: 10,
    reorder_level: 10,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    secret_column: 'must not leak',
  };

  it('converts the price and works out is_low_stock', () => {
    const product = toProduct(row);

    expect(product.price).toBe(10);
    expect(product.is_low_stock).toBe(true);
  });

  it('lists exactly the contract fields, so a new column never leaks', () => {
    expect(Object.keys(toProduct(row))).toEqual([
      'id',
      'name',
      'category_id',
      'category_name',
      'price',
      'stock_quantity',
      'reorder_level',
      'is_low_stock',
      'created_at',
      'updated_at',
    ]);
  });
});

describe('toSale', () => {
  it('converts unit_price and total to numbers and keeps the contract fields', () => {
    const sale = toSale({
      id: 3,
      product_id: 3,
      product_name: 'Chips',
      category_id: 2,
      category_name: 'Snacks',
      quantity: 2,
      unit_price: '12.50',
      total: '25.00',
      payment_method: 'cash',
      sale_date: '2026-10-05T12:00:00.000Z',
      created_at: '2026-10-05T12:00:00.000Z',
      extra: 'must not leak',
    });

    expect(sale.unit_price).toBe(12.5);
    expect(sale.total).toBe(25);
    expect(sale).not.toHaveProperty('extra');
    expect(Object.keys(sale)).toHaveLength(11);
  });
});
