const db = require('../db');
const { toNumber, toTopProduct } = require('../mappers');

// Metric definitions, word for word from dev_docs/05 Section 7.2 (D-09).
// Samuel's kpi_summary.sql and Power BI use the same ones: change them there too.
//   total_revenue        sum of quantity x unit_price in the period, rounded to 2 dp at the end
//   total_orders         number of sales in the period
//   average_order_value  total_revenue / total_orders, rounded to 2 dp; 0 when there are no orders
//   total_units_sold     sum of quantity in the period
//   low_stock_count      products with stock_quantity <= reorder_level now (ignores the period)
//   top_products         up to 5 products with the highest revenue in the period;
//                        ties broken by product_name A-Z; only products with sales

// The period as whole UTC days, like GET /api/sales. $1 = from, $2 = to;
// a null date means "no limit on that side".
const IN_PERIOD = `
  ($1::date IS NULL OR s.sale_date >= $1::date::timestamp AT TIME ZONE 'UTC')
  AND ($2::date IS NULL OR s.sale_date < ($2::date + 1)::timestamp AT TIME ZONE 'UTC')
`;

// COALESCE: SUM over no rows is NULL, not 0. NULLIF: no orders gives NULL
// instead of a division by zero. AOV divides the unrounded revenue.
const TOTALS_SQL = `
  SELECT COUNT(*)::int AS total_orders,
         COALESCE(SUM(s.quantity), 0)::int AS total_units_sold,
         ROUND(COALESCE(SUM(s.quantity * s.unit_price), 0), 2) AS total_revenue,
         ROUND(COALESCE(SUM(s.quantity * s.unit_price) / NULLIF(COUNT(*), 0), 0), 2)
           AS average_order_value
  FROM sales s
  WHERE ${IN_PERIOD}
`;

const TOP_PRODUCTS_SQL = `
  SELECT p.id AS product_id, p.name AS product_name, c.name AS category_name,
         SUM(s.quantity)::int AS units_sold,
         ROUND(SUM(s.quantity * s.unit_price), 2) AS revenue
  FROM sales s
  JOIN products p ON p.id = s.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE ${IN_PERIOD}
  GROUP BY p.id, p.name, c.name
  ORDER BY revenue DESC, p.name ASC
  LIMIT 5
`;

// Stock is a "now" figure, so no period here.
const LOW_STOCK_SQL = `
  SELECT COUNT(*)::int AS low_stock_count
  FROM products
  WHERE stock_quantity <= reorder_level
`;

// One read-only REPEATABLE READ transaction: all three queries see the same
// snapshot, so a sale recorded halfway through can't make them disagree.
async function get({ from, to }) {
  const params = [from ?? null, to ?? null];

  return db.withTransaction(
    async (client) => {
      const totals = await client.query(TOTALS_SQL, params);
      const top = await client.query(TOP_PRODUCTS_SQL, params);
      const lowStock = await client.query(LOW_STOCK_SQL);
      const row = totals.rows[0];

      return {
        period: { from: from ?? null, to: to ?? null },
        total_revenue: toNumber(row.total_revenue),
        total_orders: row.total_orders,
        average_order_value: toNumber(row.average_order_value),
        total_units_sold: row.total_units_sold,
        low_stock_count: lowStock.rows[0].low_stock_count,
        top_products: top.rows.map(toTopProduct),
      };
    },
    { readOnly: true },
  );
}

module.exports = {
  get,
};
