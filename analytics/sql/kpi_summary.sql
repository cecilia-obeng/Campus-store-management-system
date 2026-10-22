-- CS-71 (#33): KPI summary, matching metric definitions in 05 section 7.2.
-- PostgreSQL. Run against the same database and date range as GET /api/summary.
-- Change the two dates below to match the API's `from` and `to` parameters.
-- Both dates are inclusive UTC calendar days; do not use the server's local timezone.
-- The API must return HTTP 400 for invalid dates or when `from` > `to`.
-- This SQL expects valid DATE inputs and does not implement HTTP error handling.

WITH params AS (
    SELECT DATE '2026-01-01' AS date_from,
           DATE '2026-12-31' AS date_to
),
period_sales AS (
    SELECT s.id, s.quantity, s.unit_price
    FROM public.sales AS s
    CROSS JOIN params AS p
    WHERE s.sale_date >= (p.date_from::timestamp AT TIME ZONE 'UTC')
      AND s.sale_date < ((p.date_to + 1)::timestamp AT TIME ZONE 'UTC')
),
period_totals AS (
    SELECT
        COALESCE(SUM(quantity * unit_price), 0) AS unrounded_revenue,
        COUNT(*) AS total_orders,
        COALESCE(SUM(quantity), 0) AS total_units_sold
    FROM period_sales
),
rounded_totals AS (
    SELECT
        ROUND(unrounded_revenue, 2) AS total_revenue,
        total_orders,
        total_units_sold
    FROM period_totals
)
SELECT
    t.total_revenue,
    t.total_orders,
    CASE WHEN t.total_orders = 0 THEN 0::numeric
         ELSE ROUND(t.total_revenue / t.total_orders, 2)
    END AS average_order_value,
    t.total_units_sold,
    (
        SELECT COUNT(*)
        FROM public.products AS p
        WHERE p.stock_quantity <= p.reorder_level
    ) AS low_stock_count
FROM rounded_totals AS t;

-- `top_products` is a separate, ranked result set, not a scalar KPI.
-- For #33, implement it in analytics/sql/top_products.sql:
-- SUM(s.quantity * s.unit_price) per product over the same UTC period;
-- include only products with sales, ORDER BY revenue DESC, product_name ASC, LIMIT 5.
