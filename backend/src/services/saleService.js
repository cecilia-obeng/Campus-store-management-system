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

// Pass the transaction's client inside a transaction (before COMMIT, a new or
// changed sale is invisible to other connections), or db for a plain read.
async function findSale(client, id) {
  const { rows } = await client.query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  return rows[0];
}


// ORDER BY can't take $n parameters, so user input only picks a key here.
// The tie-breaker goes the same direction, so equal values keep a fixed order.
const SALE_SORT_SQL = {
  sale_date: 's.sale_date ASC, s.id ASC',
  '-sale_date': 's.sale_date DESC, s.id DESC',
  total: '(s.quantity * s.unit_price) ASC, s.id ASC',
  '-total': '(s.quantity * s.unit_price) DESC, s.id DESC',
};

// Builds "WHERE ..." from the list filters. Dates are whole days in UTC:
// from = midnight UTC that day; to = up to (not including) midnight UTC after it.
function buildSalesWhere(filters) {
  const conditions = [];
  const values = [];

  if (filters.from !== undefined) {
    values.push(filters.from);
    conditions.push(`s.sale_date >= $${values.length}::date::timestamp AT TIME ZONE 'UTC'`);
  }
  if (filters.to !== undefined) {
    values.push(filters.to);
    conditions.push(`s.sale_date < ($${values.length}::date + 1)::timestamp AT TIME ZONE 'UTC'`);
  }
  if (filters.product_id !== undefined) {
    values.push(filters.product_id);
    conditions.push(`s.product_id = $${values.length}`);
  }
  if (filters.category_id !== undefined) {
    values.push(filters.category_id);
    conditions.push(`p.category_id = $${values.length}`);
  }
  if (filters.payment_method !== undefined) {
    values.push(filters.payment_method);
    conditions.push(`s.payment_method = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
}

async function list(filters) {
  const { where, values } = buildSalesWhere(filters);
  const offset = (filters.page - 1) * filters.limit;
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [pageResult, countResult] = await Promise.all([
    db.query(
      `${SALE_SELECT} ${where} ORDER BY ${SALE_SORT_SQL[filters.sort]} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, filters.limit, offset],
    ),
    // The JOIN is needed because category_id lives on products, not on sales.
    db.query(
      `SELECT COUNT(*)::int AS total FROM sales s JOIN products p ON p.id = s.product_id ${where}`,
      values,
    ),
  ]);

  return {
    data: pageResult.rows.map(toSale),
    meta: { page: filters.page, limit: filters.limit, total: countResult.rows[0].total },
  };
}

// A plain read, so no transaction: db.query sees every committed sale.
async function getById(id) {
  const sale = await findSale(db, id);
  if (!sale) {
    throw notFound(`Sale ${id} was not found.`);
  }
  return toSale(sale);
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
  list,
  getById,
  record,
};
