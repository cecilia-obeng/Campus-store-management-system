# Database schema alignment — review and change log

**Date:** 12 October 2026  
**Project:** Campus Store Management System  
**Basis:** Database contribution (`init(1).sql`, `seed(1).sql`) compared with the proposed `04-database-schema.md` and `05-schema-change-request.md` supplied for review.  
**Status:** Proposed reconciliation, prepared for team review; not a record of an approved/merged backend contract.

## 1. Executive decision

**Proposed approach:** Align the v1 database field names and integrity rules with Joseph's schema proposal, while keeping the current GitHub paths `database/init.sql` and `database/seed.sql` until deployment layout is confirmed. Keep the existing sample-data generation logic and its validated counts. No application API or new-sale stock processing is implemented here.

## 2. Differences, resolution and rationale

| Area | Earlier database implementation | Proposed contract | Change in revised files | Reason / implication |
| --- | --- | --- | --- | --- |
| Primary keys | `categories.category_id`, `products.product_id`, `sales.sale_id` | `id` in each table | **Adopted** `id` and changed references/joins accordingly | Matches the proposed API and analytics contract. Foreign keys remain `products.category_id`, `sales.product_id`. |
| Primary key type | `BIGINT` identity | `INTEGER` identity | **Adopted** `INTEGER` on both keys and FKs | Avoids Node `pg` default BIGINT-as-string serialization for ordinary IDs; has a smaller max range. |
| Category name | `categories.category_name` | `categories.name` | **Renamed** | Proposed shared naming convention. |
| Category description | None | `categories.description TEXT` | **Added**, nullable | Supports the proposed category API response; no descriptions are invented in the seed. |
| Product name | `products.product_name VARCHAR(150)` | `products.name VARCHAR(100)` | **Renamed**, length aligned to 100 | Proposed shared contract; original 24 product names all fit. |
| Product price | `products.unit_price NUMERIC(12,2)` | `products.price NUMERIC(10,2)` | **Renamed** and precision aligned | Proposed API naming; reduced numeric range but ample for the sample prices. |
| Sale unit price | `sales.unit_price_at_sale NUMERIC(12,2)` | `sales.unit_price NUMERIC(10,2)` | **Renamed** and precision aligned | Still records historical price at the time of a sale. |
| Sale date | `sales.sale_date TIMESTAMPTZ` | `sales.sale_date TIMESTAMPTZ` | **Kept unchanged** | Already agreed previously; no `sold_at` remains in supplied current SQL. |
| Reorder threshold | `products.reorder_level`, default 10 | Retain, default 10 | **Kept unchanged** | Threshold is per product. Low-stock condition is `stock_quantity <= reorder_level`. |
| Product state | `products.is_active BOOLEAN` | Omit in v1 | **Removed** | Proposed v1 uses deletion; inactive/archived products are not supported in this schema. |
| Sale state | `sales.status` (`completed` or `cancelled`) | Omit in v1 | **Removed** from schema, seed and verification/reporting queries | Cancelling a sale must delete the row and restore stock within one backend transaction. This loses cancellation history. |
| Names validated | No trim/nonempty checks; category name unique | Trim/nonempty checks | **Added** for category/product names | Prevents empty and space-padded values at database level. |
| Product duplicates | No unique product-name rule | Case-insensitive unique globally | **Added** unique index on `LOWER(products.name)` | Allows API to map SQLSTATE `23505` to HTTP `409`; blocks same name in different categories too. |
| Category duplicates | Case-sensitive `UNIQUE` | Case-sensitive `UNIQUE` | **Retained** | Category names differing only by case are still possible; not changed without agreement. |
| Query performance | No explicit foreign-key/date indexes | Index category FK, sale FK, sale date | **Added** three indexes | Useful for filtered product lists and sales reporting; PostgreSQL does not index FKs automatically. |
| Product timestamps | `updated_at` set on insert/seed only | Refresh timestamp on updates | **Added** `set_updated_at()` trigger | Applies to every product UPDATE, not just the seed. |
| Existing inventory safeguards | Stock/reorder nonnegative; sales quantity positive | Same | **Retained** | Schema prevents invalid stored values; backend still needs atomic sell/cancel workflows. |
| Payment methods | `cash`, `card`, `mobile_money` | Same | **Retained** | No change in accepted methods. |
| Repository location | `database/init.sql` and `database/seed.sql` | `database/init/01_schema.sql` for Docker | **Not changed**; maintained existing repository paths | Docker/Compose file and mount configuration were not provided. Relocating would be speculative and could break established paths. |
| Historical seed data | 6 categories, 24 products, 200 sales, 402 units sold, 2,043 stock remaining | Compatible | **Preserved** sample data and stock-reconciliation checks | Dataset remains comparable before/after alignment. |

## 3. What was updated in the files

- **`database/init.sql`:** Adopts the proposed three-table column names and INTEGER keys; adds category descriptions, product-name uniqueness, trimming checks, foreign-key/date indexes and product timestamp trigger; removes `is_active` and sales `status`.
- **`database/seed.sql`:** Adapts every insert, join, staged-sale record, stock deduction and report to the revised names. Removes status values/filters. Preserves the original product rows and deterministic 200-sale allocation, with transaction rollback on validation errors.
- **`database/verify.sql`:** Provides read-only sample totals, key column checks, reorder threshold report and a top-five-products query using the new names.
- **`README.md`:** Explains the revised database, implementation boundary and fresh-setup order. Supersedes descriptions of `is_active`, `status` and old column names.
- **This report:** Documents alignment decisions and limitations, without altering the two source review documents.

## 4. Remaining decisions and integration risks

1. **Sale cancellation (highest-priority business decision).** Joseph proposed physically deleting a sale and restoring its units to stock. That simplifies active revenue queries but permanently removes the cancelled sale from the database and its audit history. Confirm this is acceptable for v1. Whether cancelling is allowed after refunds, exports or later stock adjustments is not defined in the supplied documents.
2. **Transactions still belong to the backend.** The schema does not automatically deduct or restore stock for NEW sales. Creating a sale, checking stock, and changing inventory must be one atomic transaction using appropriate row locking or conditional updates. Deleting a sale and returning its stock must also be atomic. The 200 historical sales in the seed have already been deducted.
3. **Product deletion.** Products linked to historical sales cannot be deleted (`ON DELETE RESTRICT`). With `is_active` removed, there is no soft-deactivation option in v1. A product with no historical sales can be deleted.
4. **Name uniqueness scope.** The index is global across all categories, not per category. This follows Joseph's proposal but may be restrictive if different categories legitimately share a product name.
5. **Deployment layout.** Joseph's proposed `database/init/01_schema.sql` references a PostgreSQL container with an empty volume. Neither the Docker Compose configuration nor `04-database-design.md` was included in this review, so the exact database initialization path and all API field expectations **could not be independently verified**. Current repository paths were preserved.
6. **Demo inventory alerts.** The seed keeps `reorder_level = 10` for all products. The sample stock balances have a minimum of 25, so the initial demo will show no low-stock products unless thresholds or stocks are deliberately adjusted. No test alert was fabricated in the fixture.
7. **Category descriptions and currency.** Category descriptions are nullable, and the sample prices do not have an agreed currency label. Neither has been invented.

## 5. Validation status

- Source SQL and proposed schema were compared field by field.
- The revised seed keeps the original 24 product entries and sales allocation, which calculates 402 units sold from opening inventory of 2,445, leaving 2,043 units. (Independent arithmetic reproduction.)
- PostgreSQL 18 execution of the **revised** `init.sql` and `seed.sql` has **not** been performed in the current review environment. Run them against an empty test database before merging.
- The prior live database is populated using the earlier naming scheme; updating repository files alone **will not modify that local database**. Do not run the fresh-install files on the existing populated schema. Back up and perform an agreed rebuild or write a separate data-preserving migration.

## 6. Recommended PR scope

**Change:** `database/init.sql`, `database/seed.sql`, `database/verify.sql`, `README.md`, `docs/schema-alignment-report.md`.

**Not part of this PR:** Endpoint implementation, live stock-decrement or sale-cancellation functions, alterations to Power BI reports, Docker initialization path changes, or a migration of an existing populated PostgreSQL database.
