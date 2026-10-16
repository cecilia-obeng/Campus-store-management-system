const fs = require('fs');
const path = require('path');
const db = require('../../src/db');

// Samuel's real schema, so the tests break if the schema and the code drift apart.
const INIT_SQL = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'database', 'init.sql'),
  'utf8',
);

// A tiny dataset where every expected value can be worked out by hand.
//
// Categories (id: name -> products)
//   1 Drinks -> 2    2 Snacks -> 2    3 Empty -> 0
//
// Products (ids follow the insert order)
//   id  name   category  price  stock  reorder  low?
//   1   Cola   1         10.00  50     10       no   (2 sales)
//   2   Water  1          5.00  10     10       YES  (stock = level: D-01 says <=)
//   3   Chips  2         12.50   3      5       YES  (1 sale)
//   4   Gum    2          2.00 100     10       no   (never sold: can be deleted)
//
// Sales (ids follow the insert order)
//   id  product  qty  unit price  total  payment       sale_date (UTC)
//   1   Cola     2    10.00       20.00  cash          2026-09-30 23:30  (late on the last day)
//   2   Cola     1    10.00       10.00  card          2026-10-01 00:00  (first second of the next)
//   3   Chips    1    12.50       12.50  mobile_money  2026-10-05 12:00

//
// Product timestamps are fixed in the past, so "updated_at moved forward"
// never depends on two clock readings taken milliseconds apart.
const FIXTURE_SQL = `
  INSERT INTO categories (name) VALUES ('Drinks'), ('Snacks'), ('Empty');

  INSERT INTO products
    (name, category_id, price, stock_quantity, reorder_level, created_at, updated_at)
  VALUES
    ('Cola', 1, 10.00, 50, 10, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ('Water', 1, 5.00, 10, 10, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ('Chips', 2, 12.50, 3, 5, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ('Gum', 2, 2.00, 100, 10, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

  INSERT INTO sales
    (product_id, quantity, unit_price, payment_method, sale_date)
  VALUES
    (1, 2, 10.00, 'cash', '2026-09-30T23:30:00Z'),
    (1, 1, 10.00, 'card', '2026-10-01T00:00:00Z'),
    (3, 1, 12.50, 'mobile_money', '2026-10-05T12:00:00Z');
`;

// Drops everything, rebuilds the schema from init.sql, and loads the fixture.
// Refuses to run on any database whose name doesn't end in _test,
// so a wrong DATABASE_URL can never wipe your development data.
async function resetDb() {
  const { rows } = await db.query('SELECT current_database() AS name');
  if (!rows[0].name.endsWith('_test')) {
    throw new Error(
      `Refusing to reset "${rows[0].name}": tests only run on a database whose name ends in _test.`,
    );
  }

  await db.query(`
    DROP TABLE IF EXISTS sales, products, categories CASCADE;
    DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
  `);
  await db.query(INIT_SQL);
  await db.query(FIXTURE_SQL);
}

module.exports = { resetDb };
