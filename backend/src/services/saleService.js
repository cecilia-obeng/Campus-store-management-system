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


// Gives units back to a product's stock (a correction downwards, or a cancel).
// Returns the stock after the change and the reorder level.
async function returnStock(client, productId, quantity) {
  const { rows } = await client.query(
    `UPDATE products
     SET stock_quantity = stock_quantity + $2
     WHERE id = $1
     RETURNING stock_quantity, reorder_level`,
    [productId, quantity],
  );
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

// PUT /api/sales/:id. Stock moves by the DIFFERENCE between the new and the old
// quantity, in the same transaction as the change to the sale.
async function correct(id, input) {
  return db.withTransaction(async (client) => {
    // FOR UPDATE locks this sale row until COMMIT: a second correction or a
    // cancel of the same sale waits here, then reads the quantity we wrote.
    const { rows } = await client.query(
      'SELECT product_id, quantity FROM sales WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (rows.length === 0) {
      throw notFound(`Sale ${id} was not found.`);
    }
    const { product_id: productId, quantity: oldQuantity } = rows[0];

    const delta = input.quantity === undefined ? 0 : input.quantity - oldQuantity;
    let stock;
    if (delta > 0) {
      stock = await takeStock(client, productId, delta);
    } else if (delta < 0) {
      stock = await returnStock(client, productId, -delta);
    } else {
      // Nothing to move. Read only: an UPDATE would touch products.updated_at.
      const current = await client.query(
        'SELECT stock_quantity, reorder_level FROM products WHERE id = $1',
        [productId],
      );
      stock = current.rows[0];
    }

    // COALESCE($n, column): the new value if one was sent, otherwise the old one.
    await client.query(
      `UPDATE sales
       SET quantity = COALESCE($2, quantity),
           payment_method = COALESCE($3, payment_method),
           sale_date = COALESCE($4::timestamptz, sale_date)
       WHERE id = $1`,
      [id, input.quantity ?? null, input.payment_method ?? null, input.sale_date ?? null],
    );

    const sale = await findSale(client, id);
    return {
      ...toSale(sale),
      product_stock_after: stock.stock_quantity,
      is_low_stock: isLowStock(stock.stock_quantity, stock.reorder_level),
    };
  });
}

// DELETE /api/sales/:id. The sale is deleted (D-04: no "cancelled" status in v1)
// and its quantity goes back to stock, both in one transaction.
async function cancel(id) {
  await db.withTransaction(async (client) => {
    const { rows } = await client.query(
      'DELETE FROM sales WHERE id = $1 RETURNING product_id, quantity',
      [id],
    );
    if (rows.length === 0) {
      throw notFound(`Sale ${id} was not found.`);
    }
    await returnStock(client, rows[0].product_id, rows[0].quantity);
  });
}



module.exports = {
  list,
  getById,
  record,
  correct,
  cancel,
};
