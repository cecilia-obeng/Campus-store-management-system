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
// Sales: Cola x2 and x1 at 10.00, Chips x1 at 12.50
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

  INSERT INTO sales (product_id, quantity, unit_price, payment_method) VALUES
    (1, 2, 10.00, 'cash'),
    (1, 1, 10.00, 'card'),
    (3, 1, 12.50, 'mobile_money');
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
