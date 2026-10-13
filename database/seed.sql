-- Campus Store Management System | Sample development data (v1)
-- Run AFTER database/init.sql on a NEW database with empty tables.
-- 6 categories, 24 products, exactly 200 example sales.
-- Illustrative prices; reporting currency has not been agreed.
-- The seed deducts historical sample sales from opening inventory once.

BEGIN;

-- Fail safely on repeat runs, avoiding duplicate sample records.
LOCK TABLE categories, products, sales IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM categories)
       OR EXISTS (SELECT 1 FROM products)
       OR EXISTS (SELECT 1 FROM sales) THEN
        RAISE EXCEPTION 'Seed requires empty categories, products and sales tables; no data has been changed.';
    END IF;
END;
$$;

INSERT INTO categories (name) VALUES
    ('Beverages'),
    ('Campus Merchandise'),
    ('Electronics'),
    ('Personal Care'),
    ('Snacks'),
    ('Stationery');

-- Opening stock is captured before simulated sales are applied.
INSERT INTO products (category_id, name, price, stock_quantity)
SELECT c.id, v.product_name, v.price, v.opening_stock
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
) AS v(category_name, product_name, price, opening_stock)
JOIN categories AS c ON c.name = v.category_name
ORDER BY array_position(ARRAY[
    'Bottled Water 500ml',
    'Cola 330ml',
    'Fruit Juice 250ml',
    'Iced Tea 500ml',
    'Campus T-Shirt',
    'Campus Hoodie',
    'Campus Lanyard',
    'Canvas Tote Bag',
    'USB-C Charging Cable',
    'USB Flash Drive 32GB',
    'Wired Earphones',
    'Phone Wall Charger',
    'Hand Sanitizer 100ml',
    'Pocket Tissue Pack',
    'Soap Bar',
    'Lip Balm',
    'Plantain Chips',
    'Biscuit Pack',
    'Chocolate Bar',
    'Granola Bar',
    'A5 Ruled Notebook',
    'Blue Ballpoint Pen',
    'Pencil Pack',
    'Highlighter'
]::text[], v.product_name);

CREATE TEMP TABLE seed_opening_stock ON COMMIT DROP AS
SELECT id AS product_id, stock_quantity AS opening_stock
FROM products;

-- Generate sales over approximately 50 days, with 1-3 units per sale.
CREATE TEMP TABLE seed_sales ON COMMIT DROP AS
WITH numbered_products AS (
    SELECT id AS product_id, price,
           ROW_NUMBER() OVER (ORDER BY id) AS product_number
    FROM products
), sample_numbers AS (
    SELECT GENERATE_SERIES(1, 200) AS n
)
SELECT
    p.product_id,
    1 + ((n.n * 11 + (n.n / 5)) % 3) AS quantity,
    p.price AS unit_price,
    CURRENT_TIMESTAMP - ((201 - n.n) * INTERVAL '6 hours') AS sale_date,
    CASE (n.n % 3)
        WHEN 0 THEN 'mobile_money'
        WHEN 1 THEN 'cash'
        ELSE 'card'
    END AS payment_method
FROM sample_numbers AS n
JOIN numbered_products AS p
  ON p.product_number = 1 + (((n.n - 1) * 7 + ((n.n - 1) / 24)) % 24);

-- Deduct the quantities recorded in the staged sales from opening stock.
-- The products UPDATE also fires trg_products_updated_at.
UPDATE products AS p
SET stock_quantity = p.stock_quantity - d.units_sold
FROM (
    SELECT product_id, SUM(quantity)::INTEGER AS units_sold
    FROM seed_sales
    GROUP BY product_id
) AS d
WHERE p.id = d.product_id;

INSERT INTO sales (product_id, quantity, unit_price, sale_date, payment_method)
SELECT product_id, quantity, unit_price, sale_date, payment_method
FROM seed_sales
ORDER BY sale_date;

-- Verify sample dataset and reconcile inventory before committing anything.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM categories) <> 6
       OR (SELECT COUNT(*) FROM products) <> 24
       OR (SELECT COUNT(*) FROM sales) <> 200 THEN
        RAISE EXCEPTION 'Unexpected sample counts; rolling back.';
    END IF;

    IF (SELECT SUM(quantity) FROM sales) <> 402
       OR (SELECT SUM(stock_quantity) FROM products) <> 2043 THEN
        RAISE EXCEPTION 'Unexpected sales quantity or stock total; rolling back.';
    END IF;

    -- Fixed payment-method split and deterministic example revenue.
    IF (SELECT COUNT(*) FROM sales WHERE payment_method = 'cash') <> 67
       OR (SELECT COUNT(*) FROM sales WHERE payment_method = 'card') <> 67
       OR (SELECT COUNT(*) FROM sales WHERE payment_method = 'mobile_money') <> 66 THEN
        RAISE EXCEPTION 'Unexpected payment split; rolling back.';
    END IF;

    IF (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM sales) <> 12549.50 THEN
        RAISE EXCEPTION 'Unexpected seed revenue; rolling back.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM products AS p
        JOIN seed_opening_stock AS o ON o.product_id = p.id
        LEFT JOIN (
            SELECT product_id, SUM(quantity)::INTEGER AS units_sold
            FROM sales GROUP BY product_id
        ) AS s ON s.product_id = p.id
        WHERE p.stock_quantity <> o.opening_stock - COALESCE(s.units_sold, 0)
    ) THEN
        RAISE EXCEPTION 'Product stock reconciliation failed; rolling back.';
    END IF;
END;
$$;

COMMIT;

-- Expected: 6 categories, 24 products, 200 sales, 402 units sold, 2,043 left; revenue 12,549.50.
SELECT
    (SELECT COUNT(*) FROM categories) AS category_count,
    (SELECT COUNT(*) FROM products) AS product_count,
    (SELECT COUNT(*) FROM sales) AS sales_count,
    (SELECT COALESCE(SUM(quantity), 0) FROM sales) AS units_sold,
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM products) AS remaining_units,
    (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM sales) AS revenue;

-- Revenue breakdown, including products with zero sales.
SELECT p.name AS product_name,
       p.stock_quantity AS stock_remaining,
       COALESCE(SUM(s.quantity), 0) AS units_sold,
       COALESCE(SUM(s.quantity * s.unit_price), 0) AS revenue
FROM products AS p
LEFT JOIN sales AS s ON s.product_id = p.id
GROUP BY p.id, p.name, p.stock_quantity
ORDER BY units_sold DESC, p.name;
