# 08. Testing and Reconciliation

| | |
|---|---|
| **Owners** | Everyone tests their own area. Samuel and Joseph own the reconciliation. |
| **Status** | v1.0 (13 Oct 2026) |

---

## 1. Test levels

| Level | Tool | Owner | Runs in |
|-------|------|-------|---------|
| Unit | Vitest | Joseph, Cecilia | local + CI |
| API integration (real Postgres built from `database/init.sql`) | Vitest + Supertest | Joseph | local + CI |
| DB scripts (`init` → `seed` → `verify` on an empty DB) | `psql -v ON_ERROR_STOP=1` | Samuel, Nana Yaw | CI |
| Stack smoke (`docker compose up`, `/api/health` = 200) | Docker + curl | Nana Yaw | CI |
| Manual API | Postman collection ([05 §10](05-api-reference.md#10-postman--curl-smoke-test)) | Joseph | before each review |
| Manual UI | checklist §3 | Cecilia | before each review |
| Reconciliation | API vs SQL vs Power BI (§4) | Samuel + Joseph | Sprint 2, Day 4 |

---

## 2. API acceptance tests

| ID | Req | Case | Expected |
|----|-----|------|----------|
| T-01 | FR-01 | create a valid product | 201, `Location` header, name trimmed |
| T-02 | FR-07 | duplicate name in a different case | 409 `DUPLICATE` |
| T-03 | FR-41 | price -1, stock 1.5, name "X" | 400 with `details` for each field |
| T-04 | FR-41 | category 999 | 400 on `category_id` |
| T-05 | FR-02/13 | update a price | 200; past sales keep their `unit_price` |
| T-06 | FR-04/05 | `search` + `category_id` + `low_stock` + `sort` | correct subset and order |
| T-07 | FR-06 | delete a product that has sales | 409 `IN_USE` |
| T-08 | FR-06 | delete an unsold product | 204 |
| T-09 | FR-10/11/13 | record a sale with a forged `unit_price` | 201; price = product price; stock decreases by qty |
| T-10 | FR-12 | oversell | 409 `INSUFFICIENT_STOCK` with `available`; stock **unchanged** |
| T-11 | NFR-03 | simultaneous sales against small stock | exactly `stock` succeed; stock never negative |
| T-12 | FR-41 | invalid payment method; future `sale_date` | 400 |
| T-13 | FR-15 | correct qty up / down | stock moves by the difference; 409 if short |
| T-14 | FR-15 | change `product_id`; empty body | 400 |
| T-15 | FR-16 | cancel a sale | 204; stock restored; second cancel 404 |
| T-16 | FR-14 | `from` / `to` filters | the whole `to` day included; `from > to` → 400 |
| T-17 | FR-30 | summary on a known small dataset | totals equal the hand-calculated values |
| T-18 | FR-30 | summary for an empty period | AOV 0, `top_products: []` |
| T-19 | FR-20 | stock equal to the reorder level | `is_low_stock: true` |
| T-20 | FR-41 | broken JSON; unknown route; id `abc` | 400 `INVALID_JSON`; 404 `ROUTE_NOT_FOUND`; 400 |
| T-21 | n/a | database stopped | `/api/health` 503; API stays up |

Every business rule must have at least one automated test before Sprint 2 Day 4.

---

## 3. UI manual checklist

| # | Journey | Pass when |
|---|---------|-----------|
| U-01 | Products list | loads with a loading state; empty search shows "No products match" |
| U-02 | Search + category + low-stock filter | combine correctly; page resets to 1 |
| U-03 | Add product | required markers; API field errors under fields; duplicate-name message |
| U-04 | Edit product | form pre-filled; list updates |
| U-05 | Delete product | confirm dialog; "has sales" message for sold products |
| U-06 | Record sale | done in under 15 s; success message; stock decreases |
| U-07 | Oversell | clear message with the available quantity; nothing saved |
| U-08 | Double-click Save | only one sale recorded |
| U-09 | Low-stock warning | appears right after a sale crosses the threshold; text and colour |
| U-10 | Sales history | newest first; filters; cancel restores stock |
| U-11 | Dashboard | KPIs and top 5 equal `GET /api/summary`; date range works |
| U-12 | API down | friendly error + Retry on every page |
| U-13 | Phone width | usable at 375 px; keyboard navigation works |

---

## 4. Reconciliation (API = SQL = Power BI)

The brief requires a note confirming that the three sources match. They can only match if all three use the **metric definitions in [05 §7.2](05-api-reference.md#72-metric-definitions-identical-in-the-api-sql-and-power-bi)** and are read from **the same database at the same moment**.

### Known issues to clear first
- **Seed revenue isn't deterministic yet** ([04 §5](04-database-schema.md#5-seed-data-databaseseedsql)): revenue can differ between two freshly seeded databases. Orders (200), units (402) and stock (2,043) are stable.
- **The month split depends on the day the database was seeded**, because sale dates are relative to the moment the seed runs. Never compare monthly figures from two different databases.

### Procedure (Sprint 2, Day 4)
1. Use one running stack (the demo laptop). Record the time, the commit hash and `SELECT now()`.
2. Freeze writes: nobody records sales during the check.
3. **API:** save `GET /api/summary` (all time) and `GET /api/summary?from=…&to=…` (one month).
4. **SQL:** run `analytics/sql/kpi_summary.sql` for the same two periods.
5. **Power BI:** refresh, then read the KPI cards for the same two periods and take screenshots.
6. Compare revenue, orders, AOV, units, low-stock count and the top-5 names and order. They must match **exactly**.
7. If something differs, check: a different DB or time? Rounding in the middle? `products.price` used instead of `sales.unit_price`? The `to` date not including the whole day? `<` instead of `<=` for low stock? A Power BI relationship duplicating rows?
8. Write `analytics/reconciliation-note.md`, signed by Samuel and Joseph.

### Note template
```markdown
# Reconciliation note
- Checked: <date time UTC> · Commit: <hash> · Database: <machine, volume created at>
- By: Samuel (SQL, Power BI), Joseph (API)

| Metric              | API | SQL | Power BI | Match |
|---------------------|----:|----:|---------:|:-----:|
| Total revenue       |     |     |          |       |
| Total orders        |     |     |          |       |
| Average order value |     |     |          |       |
| Units sold          |     |     |          |       |
| Low-stock count     |     |     |          |       |
| Top 5 (names/order) |     |     |          |       |

Period: <from> to <to>: (same table)
Differences found and fixes: …
```

---


### Running the backend tests

```
backend/tests/
├── unit/          mappers and zod schemas; no database needed
├── integration/   Supertest against a real Postgres, reset from database/init.sql
└── helpers/       resetDb.js: the small fixture every integration file starts from
```

The integration tests need a database whose name ends in `_test`. `resetDb()` refuses to touch any other database, so a wrong `DATABASE_URL` can never wipe development data. With the `db` container running (`docker compose up -d db`), create it once:

```bash
docker exec campus_store_db psql -U store_admin -d postgres -c "CREATE DATABASE campus_store_test"
```

Then, from `backend/`:

```bash
# Git Bash / macOS / Linux
DATABASE_URL=postgresql://store_admin:local_secret_password@localhost:5432/campus_store_test npm test

# PowerShell
$env:DATABASE_URL = "postgresql://store_admin:local_secret_password@localhost:5432/campus_store_test"; npm test; Remove-Item Env:DATABASE_URL
```

`npx vitest run tests/unit` runs only the unit tests, without a database. CI runs `npm run lint` and `npm test` on every pull request (the `backend` job).

`docker compose down -v` deletes `campus_store_test` along with the volume; create it again afterwards.


## 5. Sprint review demo script (about 6 minutes)

1. Stack running from `docker compose up --build`; open http://localhost:3000.
2. **Products:** search "usb", filter Electronics, show the low-stock filter.
3. **Add** "Demo Mug" (stock 3, reorder level 2).
4. **Record a sale** of 2 → stock 1 → low-stock warning.
5. **Oversell** 5 → 409 "Only 1 unit…", stock unchanged.
6. **Cancel** that sale → stock back to 3.
7. **Delete** a seeded product → "has N sales and cannot be deleted".
8. **Dashboard** KPIs and top 5, then Power BI showing the same numbers.
9. Show a green CI run on the latest PR.

The seed starts with no low-stock products, so steps 3–4 create one on purpose.
