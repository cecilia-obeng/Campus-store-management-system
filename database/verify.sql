-- Read-only verification for the development database (run after seed.sql).
-- Checks schema alignment and shows summary, low-stock and product sales data.

SELECT
    (SELECT COUNT(*) FROM categories) AS categories,
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM sales) AS sales,
    (SELECT COALESCE(SUM(quantity), 0) FROM sales) AS units_sold,
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM products) AS stock_remaining,
    (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM sales) AS revenue;

-- Expected columns: categories.description, products.reorder_level,
-- products.price, sales.sale_date, sales.unit_price.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'categories' AND column_name IN ('id','name','description'))
     OR (table_name = 'products' AND column_name IN ('id','name','price','reorder_level'))
     OR (table_name = 'sales' AND column_name IN ('id','unit_price','sale_date')) )
ORDER BY table_name, column_name;

-- Low stock uses each product's own reorder_level.
-- The initial fixture may return zero low-stock products.
SELECT id, name, stock_quantity, reorder_level
FROM products
WHERE stock_quantity <= reorder_level
ORDER BY stock_quantity, name;

SELECT p.name, COALESCE(SUM(s.quantity), 0) AS units_sold,
       COALESCE(SUM(s.quantity * s.unit_price), 0) AS revenue
FROM products AS p
LEFT JOIN sales AS s ON s.product_id = p.id
GROUP BY p.id, p.name
ORDER BY units_sold DESC, p.name
LIMIT 5;
