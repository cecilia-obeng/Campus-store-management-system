# Campus Store Management System — Database

## Overview

This contribution provides the PostgreSQL database schema, sample sales dataset, and read-only verification queries for the Campus Store Management System. It supports product categories, product inventory, and individual product sales. Backend API endpoints and live sale/cancellation processing are outside the scope of these SQL files.

## Repository structure

```text
Campus-store-management-system/
├── database/
│   ├── init.sql                     # Tables, constraints, indexes, timestamp trigger
│   ├── seed.sql                     # Sample categories, products, and historical sales
│   └── verify.sql                   # Read-only schema, inventory, and sales checks
├── docs/
│   ├── 04-database-schema.md        # Documented proposed database schema
│   └── schema-alignment-report.md  # Differences, decisions, and open questions
├── .gitignore
└── README.md
```


## Database tables

| Table | Main columns | Purpose |
| --- | --- | --- |
| `categories` | `id`, `name`, `description`, `created_at` | Product groupings. |
| `products` | `id`, `name`, `category_id`, `price`, `stock_quantity`, `reorder_level`, `created_at`, `updated_at` | Catalogue, pricing, and current inventory. |
| `sales` | `id`, `product_id`, `quantity`, `unit_price`, `payment_method`, `sale_date`, `created_at` | Individual product sales, including the unit price recorded at sale time. |

One category can contain multiple products. One product can have multiple sales. Each sale row represents a single product and its quantity; there is no `sales_items` table.

The schema uses `INTEGER` identity primary keys named `id`; foreign keys remain `products.category_id` and `sales.product_id`. The sales timestamp column is `sale_date` (not `sold_at`).

## Integrity and inventory rules

- Foreign keys protect the table relationships; a product with existing sales cannot be deleted.
- Prices, stock quantities, and reorder levels cannot be negative; sale quantity must be positive.
- Category and product names cannot be empty or padded with leading/trailing spaces.
- Category names are unique with case-sensitive matching. Product names are unique **case-insensitively** across the catalogue.
- Supported payment methods: `cash`, `card`, `mobile_money`.
- `products.reorder_level` defaults to **10**. A product is at or below its reorder threshold when `stock_quantity <= reorder_level`.
- Indexes support category filtering, sales lookup by product, and sales lookup by date.
- A database trigger updates `products.updated_at` whenever a product row changes.

This proposed v1 schema **does not contain** `products.is_active` or `sales.status`. The proposed backend cancellation approach is to remove a sale and restore stock in one transaction, but that processing is **not implemented** in these SQL files and removes the permanent cancellation record. The trade-off is described in the alignment report.

## Sample dataset

| Measure | Expected result after seeding a fresh database |
| --- | ---: |
| Categories | 6 |
| Products | 24 |
| Sales records | 200 |
| Units sold | 402 |
| Units remaining in stock | 2,043 |

The fictional dataset covers beverages, campus merchandise, electronics, personal care, snacks, and stationery. Its prices are illustrative; the reporting currency has not been specified. The seed script includes deductions for its historical sales and checks stock reconciliation. **It does not install automatic stock deduction for future API sales.**

## Database setup and verification

With PostgreSQL and a **new, empty database**, run these files in order:

1. `database/init.sql` — creates tables and integrity rules.
2. `database/seed.sql` — loads sample data and adjusts the opening inventory to account for recorded sales.
3. `database/verify.sql` — runs read-only count, column, low-stock, and top-product queries.

`seed.sql` intentionally stops if the three tables already contain rows, to avoid duplicating data. Do not rerun initialization or seed files against an existing populated database; those situations require a separately planned rebuild or migration.

For a brief summary query:

```sql
SELECT COUNT(*) AS sales_count,
       COALESCE(SUM(quantity), 0) AS units_sold,
       COALESCE(SUM(quantity * unit_price), 0) AS revenue,
       ROUND(AVG(quantity * unit_price), 2) AS average_sale_value
FROM sales;
```

## Documentation and implementation status

- [`docs/04-database-schema.md`](docs/04-database-schema.md) — revised schema specification and SQL structure.
- [`docs/schema-alignment-report.md`](docs/schema-alignment-report.md) — comparison with the earlier implementation, adopted changes, and outstanding design choices.