# Campus Store Management System — Database

## Overview

The `database/` directory contains the PostgreSQL schema, development sample data, reporting queries, and database acceptance checks for the Campus Store Management System. The SQL implementation covers product categories, products, inventory quantities, and sales records.

## Repository structure

```text
Campus-store-management-system/
├── README.md                         # Project-level README (retained)
├── docker-compose.yml                # Existing Docker configuration on main
├── database/
│   ├── README.md                     # Database-specific documentation
│   ├── init.sql                      # Executed automatically on a new PostgreSQL volume
│   ├── seed.sql                      # Executed automatically after init.sql
│   └── checks/
│       ├── verify.sql               # Manual read-only reporting
│       └── database_acceptance_verification.sql # Manual acceptance assertions
└── docs/                              # Project documentation
```

The existing `docker-compose.yml` on `main` mounts `./database` into `/docker-entrypoint-initdb.d`. Only top-level `init.sql` and `seed.sql` should execute during automatic initialization. Keep both verification scripts in `database/checks/` and invoke them manually after database initialization; do not move them back to the top level.

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

## Low-stock demonstration (Issue #56)

A fresh seed intentionally creates two low-stock examples without changing the sales,
revenue, or remaining-stock totals: **Campus Hoodie** (25 remaining, reorder level 30)
and **Phone Wall Charger** (30 remaining, reorder level 35). All other products use
reorder level 10. The `verify.sql` low-stock query shows these examples immediately;
`database_acceptance_verification.sql` asserts at least one low-stock product exists.
The values are sample alert thresholds, not real replenishment policy.

## SQL files and execution order

For a fresh, disposable development database:

1. `database/init.sql` — automatically creates tables, constraints, indexes, and trigger.
2. `database/seed.sql` — automatically seeds development data, asserting revenue, payment allocation, inventory reconciliation, and a low-stock example.
3. `database/checks/verify.sql` — run manually after initialization for inspection and reporting.
4. `database/checks/database_acceptance_verification.sql` — run manually after initialization to assert schema and data requirements.

The verification scripts are read-only and intentionally live in a subdirectory so the PostgreSQL entrypoint does not run them before the schema exists. The acceptance script uses a transaction ending in `ROLLBACK`; it does not erase committed seed data.

## Verification record

The SQL was previously checked through VS Code on PostgreSQL 18.6. The repository's existing Docker configuration on `main` uses **PostgreSQL 15 Alpine**. A successful Docker test with PostgreSQL 15 has **not yet been evidenced** and is required before merge.

## Docker compatibility and handoff

Use the `docker-compose.yml` already tracked on `main`; do not introduce a separate `compose.yaml` from the database branch. According to the PR review, its development connection uses database user `store_admin`, host port `5432`, and image `postgres:15-alpine`. Confirm the database name, service name, credentials, and volume names directly from the actual Compose file before running commands.

Nana Yaw owns the Docker/AWS implementation and fresh-build test. Coordinate a disposable test environment with him; `docker compose down -v` **permanently removes Compose-managed volumes**. After the clean build, run the acceptance SQL manually against the seeded database, for example by piping the local file to `psql` inside the running database container (replace `<db-service>` and `<db-name>` with values from the actual Compose file):

```bash
# Caution: run only after confirming that the Compose volume holds no data to preserve.
docker compose -f docker-compose.yml down -v
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml logs <db-service>
docker compose -f docker-compose.yml exec -T <db-service> psql -v ON_ERROR_STOP=1 -U store_admin -d <db-name> < database/checks/database_acceptance_verification.sql
```

Do not copy these placeholder commands verbatim. For PostgreSQL errors, check container logs and share the acceptance script's `PASS` notice and totals as PR evidence. The PostgreSQL entrypoint performs first-time initialization only when its data directory is empty.

## Scope

The SQL files implement the schema, development seed data, and verification queries. They do not implement backend API endpoints, automatic stock deductions for future sales, or sale cancellation processing.
