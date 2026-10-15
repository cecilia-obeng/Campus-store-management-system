const db = require('../db');
const { notFound, conflict } = require('../errors');
const { toSale, isLowStock } = require('../mappers');

// Shared by every sale query, so they all return the same shape.
// total is calculated here and never stored (dev_docs/05 §6.1).
const SALE_SELECT = `
  SELECT s.id, s.product_id, p.name AS product_name, p.category_id,
         c.name AS category_name, s.quantity, s.unit_price,
         s.quantity * s.unit_price AS total, s.payment_method,
         s.sale_date, s.created_at
  FROM sales s
  JOIN products p ON p.id = s.product_id
  JOIN categories c ON c.id = p.category_id
`;

// Takes quantity units off the product's stock in ONE statement: the check
// and the change happen together, so two cashiers can't both sell the last unit.
// Returns the product's price and its stock after the sale.
async function takeStock(client, productId, quantity) {
  const { rows } = await client.query(
    `UPDATE products
     SET stock_quantity = stock_quantity - $2
     WHERE id = $1 AND stock_quantity >= $2
     RETURNING price, stock_quantity, reorder_level`,
    [productId, quantity],
  );
  if (rows.length === 1) {
    return rows[0];
  }

  // No row was updated: either the product doesn't exist, or it is short.
  const found = await client.query('SELECT name, stock_quantity FROM products WHERE id = $1', [
    productId,
  ]);
  if (found.rowCount === 0) {
    throw notFound(`Product ${productId} was not found.`);
  }
  const { name, stock_quantity: available } = found.rows[0];
  throw conflict(
    'INSUFFICIENT_STOCK',
    `Only ${available} ${available === 1 ? 'unit' : 'units'} of '${name}' in stock; cannot sell ${quantity}.`,
    [{ field: 'quantity', message: `Only ${available} available.`, available, requested: quantity }],
  );
}

// Must run on the transaction's client: before COMMIT, the new sale
// is invisible to every other connection.
async function findSale(client, id) {
  const { rows } = await client.query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  return rows[0];
}

async function record(input) {
  return db.withTransaction(async (client) => {
    const stock = await takeStock(client, input.product_id, input.quantity);

    const inserted = await client.query(
      `INSERT INTO sales (product_id, quantity, unit_price, payment_method, sale_date)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
       RETURNING id`,
      [
        input.product_id,
        input.quantity,
        stock.price,
        input.payment_method,
        input.sale_date ?? null,
      ],
    );

    const sale = await findSale(client, inserted.rows[0].id);
    return {
      ...toSale(sale),
      product_stock_after: stock.stock_quantity,
      is_low_stock: isLowStock(stock.stock_quantity, stock.reorder_level),
    };
  });
}

module.exports = {
  record,
};
