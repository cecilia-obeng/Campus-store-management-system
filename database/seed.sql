-- CAMPUS STORE SALES TRACKER | STEP 2
-- Sample dataset for the Step 1 tables: categories, products, sales.
-- Run once against campus_store_db in pgAdmin Query Tool.
-- Currency: illustrative project currency units; confirm the reporting currency with the team.
-- Assumes the three tables exist and contain no records.

BEGIN;

-- Fail safely rather than silently duplicating data on a second run.
LOCK TABLE categories, products, sales IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM categories)
       OR EXISTS (SELECT 1 FROM products)
       OR EXISTS (SELECT 1 FROM sales) THEN
        RAISE EXCEPTION 'Step 2 seed requires empty categories, products, and sales tables. No data has been changed.';
    END IF;
END;
$$;

-- 1. Product categories
INSERT INTO categories (category_name) VALUES
    ('Beverages'),
    ('Campus Merchandise'),
    ('Electronics'),
    ('Personal Care'),
    ('Snacks'),
    ('Stationery');

-- 2. Product catalogue, selling prices, and opening stock
INSERT INTO products (category_id, product_name, unit_price, stock_quantity)
SELECT c.category_id, v.product_name, v.unit_price, v.opening_stock
FROM (VALUES
    ('Beverages', 'Bottled Water 500ml',        5.00, 180),
    ('Beverages', 'Cola 330ml',                10.00, 130),
    ('Beverages', 'Fruit Juice 250ml',         12.00, 120),
    ('Beverages', 'Iced Tea 500ml',            14.00, 100),
    ('Campus Merchandise', 'Campus T-Shirt',  65.00,  60),
    ('Campus Merchandise', 'Campus Hoodie',  145.00,  45),
    ('Campus Merchandise', 'Campus Lanyard',  12.00,  90),
    ('Campus Merchandise', 'Canvas Tote Bag', 40.00,  70),
    ('Electronics', 'USB-C Charging Cable',   35.00,  70),
    ('Electronics', 'USB Flash Drive 32GB',   75.00,  55),
    ('Electronics', 'Wired Earphones',        45.00,  60),
    ('Electronics', 'Phone Wall Charger',     85.00,  50),
    ('Personal Care', 'Hand Sanitizer 100ml', 18.00,  85),
    ('Personal Care', 'Pocket Tissue Pack',    7.00, 130),
    ('Personal Care', 'Soap Bar',             13.00, 100),
    ('Personal Care', 'Lip Balm',             22.00,  80),
    ('Snacks', 'Plantain Chips',              12.00, 120),
    ('Snacks', 'Biscuit Pack',                 10.00, 150),
    ('Snacks', 'Chocolate Bar',               16.00, 100),
    ('Snacks', 'Granola Bar',                 18.00, 100),
    ('Stationery', 'A5 Ruled Notebook',        18.00, 140),
    ('Stationery', 'Blue Ballpoint Pen',       4.50, 200),
    ('Stationery', 'Pencil Pack',             10.00, 100),
    ('Stationery', 'Highlighter',              9.00, 110)
) AS v(category_name, product_name, unit_price, opening_stock)
JOIN categories AS c ON c.category_name = v.category_name;

-- Opening inventory snapshot used to confirm stock reconciliation.
CREATE TEMP TABLE seed_opening_stock ON COMMIT DROP AS
SELECT product_id, stock_quantity AS opening_stock
FROM products;

-- 3. Stage exactly 200 sales spread across the previous 50 days.
-- Sales quantities range 1-3; product prices are preserved at sale time.
CREATE TEMP TABLE seed_sales ON COMMIT DROP AS
WITH numbered_products AS (
    SELECT product_id, unit_price,
           ROW_NUMBER() OVER (ORDER BY product_id) AS product_number
    FROM products
), sample_numbers AS (
    SELECT generate_series(1, 200) AS n
)
SELECT
    p.product_id,
    1 + ((n.n * 11 + (n.n / 5)) % 3) AS quantity,
    p.unit_price AS unit_price_at_sale,
    CURRENT_TIMESTAMP - ((201 - n.n) * INTERVAL '6 hours') AS sale_date,
    CASE (n.n % 3)
        WHEN 0 THEN 'cash'
        WHEN 1 THEN 'card'
        ELSE 'mobile_money'
    END AS payment_method,
    'completed'::VARCHAR(20) AS status
FROM sample_numbers AS n
JOIN numbered_products AS p
  ON p.product_number = 1 + (((n.n - 1) * 7 + ((n.n - 1) / 24)) % 24);

-- 4. Apply matching deductions for all 200 sales.
-- A PostgreSQL check constraint will reject any stock balance below zero.
UPDATE products AS p
SET stock_quantity = p.stock_quantity - d.units_sold,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT product_id, SUM(quantity)::INTEGER AS units_sold
    FROM seed_sales
    GROUP BY product_id
) AS d
WHERE p.product_id = d.product_id;

-- 5. Insert the exact same staged sales into the permanent sales table.
INSERT INTO sales
    (product_id, quantity, unit_price_at_sale, sale_date, payment_method, status)
SELECT product_id, quantity, unit_price_at_sale,
       sale_date, payment_method, status
FROM seed_sales
ORDER BY sale_date;

-- 6. Validate counts, totals, and opening-stock reconciliation before commit.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM categories) <> 6
       OR (SELECT COUNT(*) FROM products) <> 24
       OR (SELECT COUNT(*) FROM sales) <> 200 THEN
        RAISE EXCEPTION 'Seed verification failed: expected 6 categories, 24 products and 200 sales.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM products AS p
        JOIN seed_opening_stock AS o USING (product_id)
        LEFT JOIN (
            SELECT product_id, SUM(quantity)::INTEGER AS units_sold
            FROM sales
            WHERE status = 'completed'
            GROUP BY product_id
        ) AS s USING (product_id)
        WHERE p.stock_quantity <> (o.opening_stock - COALESCE(s.units_sold, 0))
    ) THEN
        RAISE EXCEPTION 'Stock reconciliation failed; rolling back the seed.';
    END IF;
END;
$$;

COMMIT;

-- 7. Verification results (run automatically at the end).
SELECT
    (SELECT COUNT(*) FROM categories) AS category_count,
    (SELECT COUNT(*) FROM products) AS product_count,
    (SELECT COUNT(*) FROM sales) AS sales_count,
    (SELECT COALESCE(SUM(quantity),0) FROM sales WHERE status = 'completed') AS units_sold,
    (SELECT COALESCE(SUM(stock_quantity),0) FROM products) AS remaining_units,
    (SELECT COALESCE(SUM(quantity * unit_price_at_sale),0) FROM sales WHERE status = 'completed') AS revenue;

-- Breakdown by product for inspection.
SELECT p.product_name, p.stock_quantity AS stock_remaining,
       COALESCE(SUM(s.quantity) FILTER (WHERE s.status = 'completed'),0) AS units_sold,
       COALESCE(SUM(s.quantity * s.unit_price_at_sale) FILTER (WHERE s.status = 'completed'),0) AS revenue
FROM products AS p
LEFT JOIN sales AS s ON s.product_id = p.product_id
GROUP BY p.product_id, p.product_name, p.stock_quantity
ORDER BY units_sold DESC, p.product_name;
