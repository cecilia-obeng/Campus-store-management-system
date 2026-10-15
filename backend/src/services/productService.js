const db = require('../db');
const { notFound } = require('../errors');
const { toProduct } = require('../mappers');

// Shared by list and getById, so both return the same shape.
const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.category_id, c.name AS category_name, p.price,
         p.stock_quantity, p.reorder_level, p.created_at, p.updated_at
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

// ORDER BY can't take $n parameters, so user input only picks a key here;
// the SQL text always comes from this object.
const SORT_SQL = {
  name: 'p.name ASC',
  '-name': 'p.name DESC',
  price: 'p.price ASC',
  '-price': 'p.price DESC',
  stock_quantity: 'p.stock_quantity ASC',
  '-stock_quantity': 'p.stock_quantity DESC',
  created_at: 'p.created_at ASC',
  '-created_at': 'p.created_at DESC',
};

// Makes \, % and _ match literally inside ILIKE.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Builds "WHERE ..." from the filters that are present, with matching $n values.
function buildWhere(filters) {
  const conditions = [];
  const values = [];

  if (filters.search !== undefined) {
    values.push(`%${escapeLike(filters.search)}%`);
    conditions.push(`p.name ILIKE $${values.length} ESCAPE '\\'`);
  }
  if (filters.category_id !== undefined) {
    values.push(filters.category_id);
    conditions.push(`p.category_id = $${values.length}`);
  }
  if (filters.low_stock === true) {
    conditions.push('p.stock_quantity <= p.reorder_level');
  } else if (filters.low_stock === false) {
    conditions.push('p.stock_quantity > p.reorder_level');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
}

async function list(filters) {
  const { where, values } = buildWhere(filters);
  const orderBy = `${SORT_SQL[filters.sort]}, p.id ASC`;
  const offset = (filters.page - 1) * filters.limit;
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [pageResult, countResult] = await Promise.all([
    db.query(
      `${PRODUCT_SELECT} ${where} ORDER BY ${orderBy} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, filters.limit, offset],
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM products p ${where}`, values),
  ]);

  return {
    data: pageResult.rows.map(toProduct),
    meta: { page: filters.page, limit: filters.limit, total: countResult.rows[0].total },
  };
}

async function getById(id) {
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  if (rows.length === 0) {
    throw notFound(`Product ${id} was not found.`);
  }
  return toProduct(rows[0]);
}

module.exports = {
  list,
  getById,
};
