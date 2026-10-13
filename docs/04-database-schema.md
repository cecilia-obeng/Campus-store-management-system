# 4. Database Schema — aligned v1 draft

| Field | Value |
| --- | --- |
| Component | PostgreSQL schema for Campus Store Management System |
| Status | Proposed aligned draft for review |
| Canonical schema file | [`database/init.sql`](../database/init.sql) |
| Sample dataset | [`database/seed.sql`](../database/seed.sql) |
| Verification queries | [`database/verify.sql`](../database/verify.sql) |
| Review decisions | [`docs/schema-alignment-report.md`](schema-alignment-report.md) |

## Purpose

This schema implements the three-table product catalogue and sales database. It incorporates the column naming and integrity suggestions in the 12 October schema-change request while preserving the existing repository layout until deployment configuration is available.

## Tables and shared field names

| Table | Columns |
| --- | --- |
| `categories` | `id`, `name`, `description`, `created_at` |
| `products` | `id`, `name`, `category_id`, `price`, `stock_quantity`, `reorder_level`, `created_at`, `updated_at` |
| `sales` | `id`, `product_id`, `quantity`, `unit_price`, `payment_method`, `sale_date`, `created_at` |

Foreign-key relationships are `products.category_id -> categories.id` and `sales.product_id -> products.id`. Primary/foreign keys are `INTEGER`, product and sale prices are `NUMERIC(10,2)`, and dates use `TIMESTAMPTZ`.

## Constraints and indexes

- Nonblank, trimmed category and product names.
- Case-sensitive unique category names; globally case-insensitive unique product names through `LOWER(name)`.
- Nonnegative prices, stock and reorder thresholds, and positive sale quantities.
- Accepted payments: `cash`, `card`, `mobile_money`.
- Restrict deletion of categories that have products and products that have sales.
- Indexes on `products(category_id)`, `sales(product_id)` and `sales(sale_date)`.
- Product `updated_at` trigger fired by product updates.

## v1 sales representation

A row in `sales` describes a single product sale at a stored `unit_price`. Line amount is calculated as `quantity * unit_price`. In this proposed v1 there is no `is_active` product flag or `status` sale field. Cancellation is proposed as a backend transaction that deletes a sale and restores inventory, subject to explicit approval of the lost audit history. The schema itself does not automate new-sale stock operations.

## Sample dataset

The companion seed populates 6 categories, 24 products and 200 sales for 402 units sold and 2,043 units of remaining stock. It uses a transaction and rejects repeated seeding.

## Deployment boundary

Run `init.sql` once, then `seed.sql`, against an empty PostgreSQL database. The previous proposal mentioned automatic Docker initialization under `database/init/01_schema.sql`, but Docker files were not provided to validate that path. The repository currently uses `database/init.sql`; any relocation remains an integration decision.

**Verification note:** These revised files were compared for naming and data arithmetic, but PostgreSQL execution should be checked before merging. See the review log for unresolved decisions and differences from the earlier implementation.
