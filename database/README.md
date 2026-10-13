# Campus Store Management System — Database

## Overview

The `database/` directory contains the PostgreSQL schema, development sample data, reporting queries, and database acceptance checks for the Campus Store Management System. The SQL implementation covers product categories, products, inventory quantities, and sales records.

## Repository structure

```text
Campus-store-management-system/
├── database/
│   ├── README.md                            # Database implementation documentation
│   ├── init.sql                             # Schema, constraints, indexes, and trigger
│   ├── seed.sql                             # Development categories, products, and sales
│   ├── verify.sql                           # Read-only reporting and inspection queries
│   └── database_acceptance_verification.sql # Read-only acceptance assertions
├── compose.yaml                              # PostgreSQL 18 development setup
├── docs/                                    # Project documentation
└── .gitignore
```

## Implemented schema

| Table | Columns | Purpose |
| --- | --- | --- |
| `categories` | `id`, `name`, `description`, `created_at` | Defines product categories. |
| `products` | `id`, `name`, `category_id`, `price`, `stock_quantity`, `reorder_level`, `created_at`, `updated_at` | Stores the product catalogue, prices, and inventory. |
| `sales` | `id`, `product_id`, `quantity`, `unit_price`, `payment_method`, `sale_date`, `created_at` | Records a product, quantity, payment method, and unit price for each sale. |

All three tables use integer identity primary keys. `products.category_id` references `categories.id`, and `sales.product_id` references `products.id`. Both foreign keys use `ON DELETE RESTRICT`. A sales record contains one product and a quantity; `unit_price` captures the sale-time price.

The schema does not include `products.is_active` or `sales.status`.

## Constraints, indexes, and trigger

| Database object | Implemented behaviour |
| --- | --- |
| `uq_categories_name` | Unique category names (case-sensitive). |
| `chk_categories_name_trim`, `chk_products_name_trim` | Names are nonempty and contain no leading or trailing spaces. |
| `uq_products_name_lower` | Unique product names regardless of letter case. |
| `chk_products_price`, `chk_products_stock_quantity`, `chk_products_reorder_level` | Nonnegative prices, stock quantities, and reorder levels. |
| `chk_sales_quantity`, `chk_sales_unit_price` | Positive sale quantities and nonnegative sale unit prices. |
| `chk_sales_payment_method` | Payment method is `cash`, `card`, or `mobile_money`. |
| `idx_products_category_id` | Index on product category. |
| `idx_sales_product_id` | Index on the product referenced by each sale. |
| `idx_sales_sale_date` | Index on sale date. |
| `trg_products_updated_at` / `set_updated_at()` | Sets `products.updated_at` on product updates. |

`products.reorder_level` defaults to `10`. The low-stock reporting query selects products for which `stock_quantity <= reorder_level`.

## Development sample data

`seed.sql` inserts six categories and 24 products, generates 200 historical sample sales, and deducts the recorded sales quantities from opening stock. Sale records are inserted in ascending `sale_date` order.

| Measure | Seed-script expected total |
| --- | ---: |
| Categories | 6 |
| Products | 24 |
| Sales records | 200 |
| Units sold | 402 |
| Remaining units in stock | 2,043 |

The categories are Beverages, Campus Merchandise, Electronics, Personal Care, Snacks, and Stationery. Sample prices are illustrative; the SQL does not designate a currency.

The seed asserts cash/card/mobile-money counts of 67/67/66 and total sample revenue of 12,549.50 (currency unspecified). The seed runs in a transaction and refuses to insert sample data if any of the three tables already contains records. Before committing, it checks the record totals, units sold, remaining stock, and per-product inventory reconciliation. The SQL seed adjusts stock for its generated historical sales; it does not implement ongoing sale or cancellation processing.

## SQL files and execution order

On a new, empty database, execute:

1. `init.sql` — creates the three tables, constraints, indexes, and product timestamp trigger.
2. `seed.sql` — populates the sample data and reconciles inventory.
3. `verify.sql` — returns dataset totals, selected column metadata, low-stock products, and the five products with the most units sold.
4. `database_acceptance_verification.sql` — checks seed totals, required constraint and index names, foreign-key delete actions, removed columns, trigger presence, and selected data-integrity conditions.

The two verification files are read-only. The acceptance script raises an exception when an assertion fails and otherwise emits a `PASS` notice and summary counts. It does not exercise deliberate constraint violations or measure trigger timestamp advancement.

## Verification record

Previously, the database was queried in VS Code against `campus_store_test` on PostgreSQL **18.6**, with 200 sales rows reported. The current Docker acceptance test has **not yet been executed**; its results must be recorded before merging.

## Docker Compose: clean development database

From the **repository root**, with Docker Desktop/Engine and Compose installed:

```bash
docker compose up --build -d
docker compose logs db
docker compose exec db psql -U campus_store -d campus_store -f /docker-entrypoint-initdb.d/03-acceptance.sql
```

On first initialization, PostgreSQL runs `01-init.sql`, `02-seed.sql`, then `03-acceptance.sql` in file-name order. Look for `PASS:` in the database logs and confirm that the database container stays healthy. The acceptance SQL is read-only and ends in `ROLLBACK`; this does not undo the committed seed. `verify.sql` remains available for manual reporting. PostgreSQL 18 is selected to match the major version previously tested in VS Code, not to imply the Docker test has passed.

**Destructive clean rebuild — only on a disposable development instance:**

```bash
docker compose down -v
docker compose up --build -d
docker compose logs db
```

`down -v` **deletes the Compose-managed database volume and all records in it**. Never run it against data that must be retained. Initialization scripts execute only when the PostgreSQL data volume is empty. The container uses host port `5433` (connect to `localhost:5433`, database/user `campus_store`). `POSTGRES_PASSWORD` defaults to a **development-only** placeholder; set a strong `POSTGRES_PASSWORD` in your environment for any shared deployment. Do not store real credentials in Git.

## Scope

The SQL files implement the schema, development seed data, and verification queries. They do not implement backend API endpoints, automatic stock deductions for future sales, or sale cancellation processing.
