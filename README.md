# Campus Store Sales Tracker — Database

## Overview

This folder contains the PostgreSQL database work for the Campus Store Sales Tracker. The database holds the product catalogue, available stock, and sales history used by the application and reporting dashboard.

## Project structure

```text
Campus-store-management-.../
├── database/
│   ├── init.sql
│   ├── seed.sql
├── .gitignore
└── README.md
```

| File | Description |
| --- | --- |
| `database/init.sql` | Database schema: tables, relationships, and constraints. |
| `database/seed.sql` | Development sample data, including product categories, products, sales, and initial stock deductions. |
| `database/migration.sql` | One-time schema change for an existing populated database. |
| `.gitignore` | Git exclusions for local or generated files. |
| `README.md` | Overview of the database implementation. |

## Database design

The database uses three related tables:

| Table | Purpose |
| --- | --- |
| `categories` | Product category information. |
| `products` | Product details, pricing, category, available stock, reorder threshold, and active status. |
| `sales` | Individual product sales, quantities, price at the time of sale, payment method, sale date/time, and status. |

**Relationships:** Each category can contain multiple products, and each product can have multiple sales. Each sales row represents one product transaction; there is no separate `sales_items` table.

The design does not use an `sku` column. `products.stock_quantity` stores current stock and `products.reorder_level` stores the per-product low-stock threshold (initially 10). Sales timestamps use `sales.sale_date` (a timestamp with time zone, not a date-only field).

## Sample dataset

The PostgreSQL sample dataset has been loaded and checked in pgAdmin 4.

| Metric | Verified result |
| --- | ---: |
| Categories | 6 |
| Products | 24 |
| Sales records | 200 |
| Units sold | 402 |
| Units remaining in stock | 2,043 |

The dataset represents fictional campus-store activity for development and dashboard testing. Amounts use illustrative currency values, not confirmed store revenue.

The seed data covers categories such as beverages, snacks, stationery, electronics, personal care, and campus merchandise. Sample sales include cash, card, and mobile-money payments.

## Data integrity

- Primary and foreign keys connect categories, products, and sales.
- Product stock cannot be negative, and sales quantities must be positive.
- Sales preserve the unit price at the time of purchase.
- The seed dataset deducts the 402 units sold from opening inventory and verifies stock reconciliation.
- `database/seed.sql` is designed for **empty tables** and prevents duplicate seeding on a second run.

## Database status and integration boundary

**Completed:** Schema implementation, realistic sample data, and record-count and stock checks in PostgreSQL.

**Outside this database submission:** API endpoints, application-level sales processing, automatic stock updates for future transactions, and sale cancellation logic. Those behaviours have not been implemented as part of this database work.

The historical sample sales are **already reflected in the remaining stock balances** and must not be deducted again during integration.

## Verification query

```sql
SELECT
    (SELECT COUNT(*) FROM categories) AS categories,
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM sales) AS sales,
    (SELECT COALESCE(SUM(quantity), 0)
     FROM sales WHERE status = 'completed') AS units_sold,
    (SELECT COALESCE(SUM(stock_quantity), 0)
     FROM products) AS stock_remaining;
```

Expected result: **6 categories · 24 products · 200 sales · 402 units sold · 2,043 units remaining**.

**Environment:** PostgreSQL 18, tested using pgAdmin 4. Local database name: `campus_store_db`.

## Database setup

For a **new empty database**, run `database/init.sql`, then `database/seed.sql`.

For the **existing populated database**, run `database/migration.sql` **once only**; do not rerun `init.sql` or `seed.sql`. The migration renames `sold_at` to `sale_date` and adds `reorder_level` (default 10) while preserving existing data.
