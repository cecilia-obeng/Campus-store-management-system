-- Campus Store Management System: acceptance verification
-- Run after init.sql and seed.sql on PostgreSQL 18 (also executed by Docker on fresh volume).
-- Read-only checks; raises an exception if an assertion fails.
BEGIN;
DO $$
DECLARE
  missing text;
BEGIN
  IF (SELECT COUNT(*) FROM categories) <> 6 OR
     (SELECT COUNT(*) FROM products) <> 24 OR
     (SELECT COUNT(*) FROM sales) <> 200 OR
     (SELECT SUM(quantity) FROM sales) <> 402 OR
     (SELECT SUM(stock_quantity) FROM products) <> 2043 THEN
    RAISE EXCEPTION 'Seed totals do not match expected 6/24/200/402/2043';
  END IF;

  IF COALESCE((SELECT SUM(quantity * unit_price) FROM sales), 0) <> 12549.50 OR
     (SELECT COUNT(*) FROM sales WHERE payment_method='cash') <> 67 OR
     (SELECT COUNT(*) FROM sales WHERE payment_method='card') <> 67 OR
     (SELECT COUNT(*) FROM sales WHERE payment_method='mobile_money') <> 66 THEN
    RAISE EXCEPTION 'Revenue or payment split does not match expected 12549.50 / 67 / 67 / 66';
  END IF;

  IF EXISTS (
     SELECT 1 FROM categories c LEFT JOIN products p ON p.category_id=c.id
     GROUP BY c.id HAVING COUNT(p.id) <> 4
  ) THEN
    RAISE EXCEPTION 'Each category must contain exactly four products';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND
              ((table_name IN ('categories','products') AND column_name='is_active') OR
               (table_name='sales' AND column_name='status'))) THEN
    RAISE EXCEPTION 'Removed column is still present';
  END IF;

  SELECT string_agg(required.name, ', ' ORDER BY required.name) INTO missing
  FROM (VALUES
    ('uq_categories_name'),('chk_categories_name_trim'),
    ('chk_products_name_trim'),('chk_products_price'),
    ('chk_products_stock_quantity'),('chk_products_reorder_level'),
    ('chk_sales_quantity'),('chk_sales_unit_price'),
    ('chk_sales_payment_method'),('products_category_id_fkey'),
    ('sales_product_id_fkey')
  ) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname=required.name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing constraints: %',missing; END IF;

  SELECT string_agg(required.name, ', ' ORDER BY required.name) INTO missing
  FROM (VALUES ('uq_products_name_lower'),('idx_products_category_id'),
    ('idx_sales_product_id'),('idx_sales_sale_date')) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_indexes i
    WHERE i.schemaname='public' AND i.indexname=required.name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing indexes: %',missing; END IF;

  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE conname IN ('products_category_id_fkey','sales_product_id_fkey')
      AND contype='f' AND confdeltype='r') <> 2 THEN
    RAISE EXCEPTION 'Foreign keys do not both use ON DELETE RESTRICT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname='trg_products_updated_at' AND NOT tgisinternal AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'Product update trigger is missing or disabled';
  END IF;

  IF EXISTS (SELECT 1 FROM products WHERE stock_quantity < 0) OR
     EXISTS (SELECT 1 FROM sales s LEFT JOIN products p ON p.id=s.product_id
             WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Invalid inventory or orphan sales';
  END IF;

  IF EXISTS (SELECT 1 FROM sales WHERE quantity <= 0 OR unit_price < 0) THEN
    RAISE EXCEPTION 'Invalid sale values';
  END IF;

  IF EXISTS (SELECT 1 FROM products GROUP BY lower(name) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Case-insensitive duplicate product names';
  END IF;
  RAISE NOTICE 'PASS: schema, category distribution, seed totals, revenue, payment split and integrity';
END $$;
SELECT current_setting('server_version') AS postgres_version,
       (SELECT COUNT(*) FROM categories) AS categories,
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM sales) AS sales,
       (SELECT SUM(quantity) FROM sales) AS units_sold,
       (SELECT SUM(stock_quantity) FROM products) AS stock_remaining,
       (SELECT SUM(quantity * unit_price) FROM sales) AS revenue,
       (SELECT COUNT(*) FROM sales WHERE payment_method='cash') AS cash_count,
       (SELECT COUNT(*) FROM sales WHERE payment_method='card') AS card_count,
       (SELECT COUNT(*) FROM sales WHERE payment_method='mobile_money') AS mobile_money_count;
ROLLBACK;
-- This does not behavior-test unique violations, delete SQLSTATE 23001,
-- or updated_at timestamp advancement; those require separate controlled tests.
