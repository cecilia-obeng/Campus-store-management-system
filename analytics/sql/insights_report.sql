-- CS-73 | Campus Store insights report supporting queries (PostgreSQL)
-- Source: database/init.sql and database/seed.sql
-- Scope: all sales currently stored (no date filter). This matches the
-- 200-row original seed when no new sales have been added.
-- Read-only: SELECT only; compatible with the analyst role.
-- To report on a chosen UTC period, add to every sales-based query:
-- WHERE s.sale_date >= (DATE '2026-08-01'::timestamp AT TIME ZONE 'UTC')
--   AND s.sale_date <  (DATE '2026-10-16'::timestamp AT TIME ZONE 'UTC')
-- Low-stock is CURRENT inventory and intentionally ignores the sales period.
-- Monetary units are unspecified in the supplied seed data.

-- Finding 1: exact KPI definitions from 05 section 7.2
SELECT
    ROUND(COALESCE(SUM(s.quantity * s.unit_price), 0), 2) AS total_revenue,
    COUNT(*) AS total_orders,
    COALESCE(ROUND(SUM(s.quantity * s.unit_price) / NULLIF(COUNT(*), 0), 2), 0) AS average_order_value,
    COALESCE(SUM(s.quantity), 0) AS total_units_sold,
    (SELECT COUNT(*) FROM products p WHERE p.stock_quantity <= p.reorder_level) AS low_stock_count
FROM sales s;

-- Finding 2: revenue concentration by category
SELECT
    c.name AS category_name,
    COUNT(*) AS total_orders,
    SUM(s.quantity) AS units_sold,
    ROUND(SUM(s.quantity * s.unit_price), 2) AS revenue,
    ROUND(100 * SUM(s.quantity * s.unit_price) /
        NULLIF((SELECT SUM(quantity * unit_price) FROM sales), 0), 2) AS revenue_pct
FROM sales s
JOIN products p ON p.id = s.product_id
JOIN categories c ON c.id = p.category_id
GROUP BY c.id, c.name
ORDER BY revenue DESC, category_name ASC;

-- Finding 3: top five revenue-generating products, deterministic ties
SELECT
    p.name AS product_name,
    COUNT(*) AS total_orders,
    SUM(s.quantity) AS units_sold,
    ROUND(SUM(s.quantity * s.unit_price), 2) AS revenue
FROM sales s
JOIN products p ON p.id = s.product_id
GROUP BY p.id, p.name
ORDER BY revenue DESC, product_name ASC
LIMIT 5;

-- Finding 4a: payment method usage and revenue
SELECT
    s.payment_method,
    COUNT(*) AS total_orders,
    SUM(s.quantity) AS units_sold,
    ROUND(SUM(s.quantity * s.unit_price), 2) AS revenue,
    ROUND(100 * SUM(s.quantity * s.unit_price) /
        NULLIF((SELECT SUM(quantity * unit_price) FROM sales), 0), 2) AS revenue_pct
FROM sales s
GROUP BY s.payment_method
ORDER BY revenue DESC, s.payment_method ASC;

-- Finding 4b: monthly UTC sales; partial months should not be compared as full months
SELECT
    TO_CHAR(DATE_TRUNC('month', s.sale_date AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_utc,
    COUNT(*) AS total_orders,
    SUM(s.quantity) AS units_sold,
    ROUND(SUM(s.quantity * s.unit_price), 2) AS revenue
FROM sales s
GROUP BY DATE_TRUNC('month', s.sale_date AT TIME ZONE 'UTC')
ORDER BY DATE_TRUNC('month', s.sale_date AT TIME ZONE 'UTC');

-- Finding 5: low-stock products as of query execution, no period filtering
SELECT
    p.name AS product_name,
    p.stock_quantity,
    p.reorder_level,
    p.reorder_level - p.stock_quantity AS units_below_threshold
FROM products p
WHERE p.stock_quantity <= p.reorder_level
ORDER BY units_below_threshold DESC, product_name ASC;
