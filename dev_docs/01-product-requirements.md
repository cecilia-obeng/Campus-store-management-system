# 01. Project Overview and Requirements

| | |
|---|---|
| **Product** | Campus Store Sales Tracker |
| **Source** | Mentor brief "Team A Project: Campus Store Sales Tracker" (Ishaque Appiah, 9 Oct 2026) |
| **Status** | Agreed v1.0 |

---

## 1. Problem

A small campus store records its sales on paper and in spreadsheets, so the manager:

- can't easily see **what is selling**;
- can't see **how much revenue** is coming in;
- doesn't know **which products are running low** until they run out;
- can't trust stock figures, because sales and stock are recorded separately.

We will build a simple web app to record products and sales, a REST API that keeps stock correct automatically, and a dashboard (in the app and in Power BI) that turns the data into insights.

## 2. Goals

| # | Goal | Measured by (v1.0) |
|---|------|--------------------|
| G1 | Record every sale digitally, with stock updated automatically | Every sale recorded through the API reduces stock by the right amount (automated test) |
| G2 | Give the manager an instant view of performance | Revenue, orders, average order value and top 5 products appear on one screen |
| G3 | Warn before products run out | Every product at or below its reorder level is flagged in the app and in Power BI |
| G4 | Turn data into decisions | Power BI dashboard plus an insights report (4–5 findings, 2–3 recommendations) |
| G5 | Numbers everyone can trust | API summary, SQL results and Power BI KPIs match exactly (reconciliation note) |
| T1 | Working containerised app | `docker compose up --build` on a fresh clone works first time |
| T2 | Professional workflow | Every change merged by reviewed PR; CI runs on every PR |

## 3. Users

| Persona | Needs | Main screens |
|---------|-------|--------------|
| **Store manager** | Maintain the catalogue, see revenue and best sellers, know what to reorder | Dashboard, Products, Sales history, Power BI |
| **Cashier** | Record a sale in a few seconds without mistakes | Record Sale |
| **Analyst** (Samuel) | Clean, consistent data, with read-only access | SQL, Power BI |

v1.0 has **no login**: every user can use every screen. Login with admin and cashier roles is a stretch goal.

### Key journeys
1. **Record a sale:** Record Sale → pick product → quantity → payment method → Save → confirmation; stock goes down. Target: under 15 seconds.
2. **Restock check:** Products → "Low stock only" → see what to reorder.
3. **Weekly review:** Dashboard → KPIs and top 5 → Power BI for monthly, category and payment trends.
4. **Maintain catalogue:** add a product, or change a price or stock count after a delivery.

---

## 4. Functional requirements

Priority: **M** = Must (the minimum version in the brief), **S** = Should, **C** = Could (stretch). The story IDs refer to [07 Sprint plan](07-sprint-plan-and-backlog.md).

### 4.1 Products
| ID | Requirement | Pri | API | Stories |
|----|-------------|-----|-----|---------|
| FR-01 | Add a product (name, category, price, stock quantity, optional reorder level) | M | `POST /api/products` | CS-22, CS-32 |
| FR-02 | Edit a product | M | `PUT /api/products/:id` | CS-22, CS-33 |
| FR-03 | List products with name, category, price, stock | M | `GET /api/products` | CS-21, CS-31 |
| FR-04 | Search products by name (partial, case-insensitive) | M | `?search=` | CS-61, CS-50 |
| FR-05 | Filter by category; combinable with search | M | `?category_id=` | CS-61, CS-50 |
| FR-06 | Delete a product that has no sales; a product with sales is refused with a clear message | M | `DELETE /api/products/:id` | CS-23 |
| FR-07 | Product names are unique (case-insensitive); price ≥ 0; stock ≥ 0 | M | DB + validation | CS-10, CS-22 |

### 4.2 Sales
| ID | Requirement | Pri | API | Stories |
|----|-------------|-----|-----|---------|
| FR-10 | Record a sale: product, quantity, date (default now) and payment method (cash, mobile money, card) | M | `POST /api/sales` | CS-24, CS-34 |
| FR-11 | Recording a sale **reduces stock automatically** | M | same transaction | CS-24 |
| FR-12 | A sale can't exceed available stock; the user is told how many are available and nothing is saved | M | 409 `INSUFFICIENT_STOCK` | CS-24 |
| FR-13 | The sale stores the **price at the time of sale** | M | `sales.unit_price` | CS-24 |
| FR-14 | List sales (newest first), filter by date range, product and payment method | M | `GET /api/sales` | CS-25, CS-52 |
| FR-15 | Correct a sale's quantity, payment method or date; stock adjusts by the difference | M | `PUT /api/sales/:id` | CS-25 |
| FR-16 | Cancel (delete) a sale; its quantity returns to stock | M | `DELETE /api/sales/:id` | CS-25, CS-52 |

### 4.3 Low-stock alerts
| ID | Requirement | Pri | Stories |
|----|-------------|-----|---------|
| FR-20 | Each product has a `reorder_level` (default 10). A product is **low stock when `stock_quantity <= reorder_level`** | M | CS-10 |
| FR-21 | Low-stock products are visibly flagged in the product list (text label and colour) | M | CS-51 |
| FR-22 | Filter to low-stock only; the dashboard shows a count | S | CS-51, CS-53 |
| FR-23 | After a sale makes a product low stock, the user is warned immediately | S | CS-34, CS-51 |

### 4.4 Summary / KPIs
| ID | Requirement | Pri | Stories |
|----|-------------|-----|---------|
| FR-30 | `GET /api/summary` returns total revenue, total orders, average order value and the top 5 products | M | CS-60 |
| FR-31 | The web app shows these KPIs on a Dashboard page | S | CS-53 |
| FR-32 | KPIs can be filtered by date range | S | CS-60, CS-53 |

### 4.5 API
| ID | Requirement | Pri | Stories |
|----|-------------|-----|---------|
| FR-40 | REST endpoints for products and sales: create, read, update, delete | M | CS-21–25 |
| FR-41 | Input validation with clear error messages and correct HTTP status codes | M | CS-22, CS-24 |
| FR-42 | API documentation (every endpoint with an example) | M | CS-63 |

### 4.6 Data and analytics
| ID | Requirement | Pri | Stories |
|----|-------------|-----|---------|
| FR-50 | PostgreSQL with `categories`, `products`, `sales` tables, with primary and foreign keys | M | CS-10 |
| FR-51 | Seed script with at least 200 sample sales | M | CS-11, CS-12 |
| FR-52 | SQL: revenue by month, by category, by payment method; top products; low-stock items | M | CS-71 |
| FR-53 | Power BI dashboard connected to the database | M | CS-72 |
| FR-54 | Insights report: 4–5 findings with figures, 2–3 recommendations | M | CS-73 |
| FR-55 | Reconciliation note: API summary = SQL = Power BI | M | CS-74 |

### 4.7 Stretch (only after every Must is Done)
| ID | Requirement | API | Stories |
|----|-------------|-----|---------|
| FR-60 | Export sales to CSV | `GET /api/sales/export.csv` | CS-S1 |
| FR-61 | In-app chart: revenue over the last 7 days | `GET /api/summary/daily?days=7` | CS-S2 |
| FR-62 | Login with admin and cashier roles | `POST /api/auth/login` | CS-S3 |

---

## 5. Non-functional requirements

| ID | Area | Requirement |
|----|------|-------------|
| NFR-01 | Portability | The whole system (db, backend, frontend) starts with `docker compose up --build` |
| NFR-02 | Setup time | A new developer runs the app from the README in 10 minutes or less (excluding downloads) |
| NFR-03 | Data integrity | Recording, correcting and cancelling a sale is atomic; stock can never go negative (API guard and DB `CHECK`) |
| NFR-04 | Security | No secrets in the repo (`.env` git-ignored, `.env.example` committed); parameterised SQL only; errors never expose stack traces or SQL |
| NFR-05 | Performance | API responses under 500 ms with seeded data on a normal laptop |
| NFR-06 | Usability | Every data screen has loading, error (with retry), empty and success states; field-level form errors; money shown as `GHS 1,234.50` |
| NFR-07 | Accessibility | Labelled inputs; low stock isn't shown by colour alone; keyboard-usable; works at phone width |
| NFR-08 | Maintainability | The agreed folder structure; lint passes; meaningful names |
| NFR-09 | Quality | CI on every PR; `main` protected; one reviewer per PR |
| NFR-10 | Consistency | KPI definitions are identical in the API, SQL and Power BI ([05 §7.2](05-api-reference.md#72-metric-definitions-identical-in-the-api-sql-and-power-bi)) |
| NFR-11 | Documentation | README covers overview, architecture, setup, endpoints and screenshots; API docs list every endpoint |

## 6. Business rules

| # | Rule |
|---|------|
| BR-1 | Currency: Ghana cedi (GHS), 2 decimal places. (The seed prices have no currency label; the UI displays GHS.) |
| BR-2 | One sale = one product line. An "order" = one row in `sales`. There is no basket and no `sales_items` table. |
| BR-3 | Payment methods: `cash`, `mobile_money`, `card` |
| BR-4 | A sale uses the product's **current price** at the moment of sale. The cashier can't enter a price. |
| BR-5 | You can't sell more than is in stock |
| BR-6 | Low stock = `stock_quantity <= reorder_level` (default reorder level 10, set per product) |
| BR-7 | A product that has sales can't be deleted (this protects history). There is no "inactive" flag in v1. |
| BR-8 | Cancelling a sale deletes it and returns its quantity to stock. The cancelled sale is not kept (an accepted v1 trade-off). |
| BR-9 | Revenue = Σ(quantity × unit_price). AOV = revenue ÷ orders, or 0 when there are no orders. |
| BR-10 | Times are stored as `TIMESTAMPTZ` and returned in UTC, which is the same as Ghana time |

## 7. Out of scope for v1.0

Multi-product baskets; returns and refunds beyond cancelling a sale; suppliers and purchase orders; multiple stores; real payment processing; receipts and barcodes; profit or margin (no cost price is stored); public cloud hosting; soft-deleting products (`is_active`) and sale status (`status`). These were removed from the v1 schema by agreement.

## 8. Final deliverables (from the brief)

- [ ] GitHub repo with full README: overview, architecture, setup (`docker compose up`), API endpoints, screenshots
- [ ] Working app running in Docker
- [ ] SQL scripts, Power BI file, dashboard screenshot, insights report
- [ ] Reconciliation note: API summary = SQL results = Power BI KPIs
- [ ] Sprint board showing completed tasks
- [ ] 15-minute presentation and live demo (22 Oct 2026)

## 9. How we are assessed

| Area | Weight | Where it is covered |
|------|-------:|---------------------|
| Working features (minimum version complete) | 30% | 05, 07, 08, 11 |
| Code quality and Git workflow | 20% | 02, 06 |
| Data analysis and insights | 15% | 04, 10 |
| Deployment and CI | 15% | 09 |
| Documentation (README, API docs) | 10% | this folder, 05, openapi.yaml |
| Teamwork and presentation | 10% | 12 |

## 10. Risks

| # | Risk | Mitigation | Owner |
|---|------|------------|-------|
| R1 | Contract changes break the frontend late | 04 and 05 are frozen; changes only by PR approved by the affected owners | Joseph |
| R2 | Env-var naming mismatch stops the frontend reaching the API | Standardise on `VITE_API_URL` (see 09) | Nana Yaw |
| R3 | API, SQL and Power BI numbers differ | One written metric definition; same DB snapshot; reconcile on Sprint 2 Day 4 | Samuel |
| R4 | Backend behind schedule (no code yet on Sprint 1 Day 3) | Step-by-step plan in 07; products CRUD first, then sales | Joseph |
| R5 | No low-stock products in the seed (minimum stock is 25), so the alert can't be demoed | Demo script records sales to cross a threshold, or Samuel raises a few `reorder_level`s | Samuel |
| R6 | Merge conflicts (e.g. `database` branch root README) | Small PRs, merge `main` often | All |
| R7 | Live demo failure | Backup laptop, recorded video, screenshots | All |
