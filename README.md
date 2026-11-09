# Campus Store Sales Tracker

A web application for managing a campus store’s products and sales. It helps staff track inventory, record sales, identify low-stock products, and review sales performance.

## Features

- View, search, and filter products by name or category.
- Create, update, and delete products.
- Record sales, view sales history, correct a sale, and cancel a sale.
- Reduce stock automatically when a sale is recorded.
- Display low-stock status returned by the API (`is_low_stock`). The rule is stock at or below the product’s reorder level.
- View dashboard KPIs and daily sales data.
- Analyze sales and inventory with SQL and Power BI.

## Architecture

- **Frontend:** React and Vite
- **API:** Node.js and Express REST API
- **Database:** PostgreSQL
- **Deployment:** Docker Compose
- **Analytics:** PostgreSQL queries and Power BI

The browser opens the frontend at `http://localhost:3000`. The frontend proxies `/api` requests to the backend at port `8000`. The API reads and writes PostgreSQL; analytics queries use the database for reporting.

## Run with Docker Compose

Requirements: Docker Desktop with Docker Compose.

From the repository root, create a local environment file if you have not already created one, then start the services:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build
```

Open:

- App: <http://localhost:3000>
- API health check: <http://localhost:8000/api/health>

Keep the terminal open while the services run. Press `Ctrl+C` to stop them. The database runs `database/init.sql` and `database/seed.sql` when its data volume is first created. Its data persists across ordinary restarts. The example credentials in `.env.example` are for local development only. Do not commit `.env` or use the example credentials for a public or production deployment.

## API

Base URL: `http://localhost:8000/api`, once the stack is running (see [Run with Docker Compose](#run-with-docker-compose)).

- **Interactive docs (Swagger UI):** <http://localhost:8000/api/docs>
- **Full contract:** [API reference](dev_docs/05-api-reference.md) and [OpenAPI specification](dev_docs/openapi.yaml)
- **Postman collection:** [backend/campus-store.postman_collection.json](backend/campus-store.postman_collection.json) (import it, or run `npx newman run backend/campus-store.postman_collection.json`)

| # | Method | Path | Purpose | Success | Errors |
|---|--------|------|---------|---------|--------|
| 1 | GET | `/api/health` | API and DB availability | 200 | 503 |
| 2 | GET | `/api/categories` | Categories for filters and forms | 200 | n/a |
| 3 | GET | `/api/products` | List, search, filter, sort, paginate | 200 | 400 |
| 4 | GET | `/api/products/:id` | One product | 200 | 400, 404 |
| 5 | POST | `/api/products` | Create product | 201 | 400, 409 |
| 6 | PUT | `/api/products/:id` | Update product (full replace) | 200 | 400, 404, 409 |
| 7 | DELETE | `/api/products/:id` | Delete product (no sales only) | 204 | 400, 404, 409 |
| 8 | GET | `/api/sales` | Sales history with filters | 200 | 400 |
| 9 | GET | `/api/sales/:id` | One sale | 200 | 400, 404 |
| 10 | POST | `/api/sales` | Record a sale; stock decreases | 201 | 400, 404, 409 |
| 11 | PUT | `/api/sales/:id` | Correct a sale; stock adjusts by the difference | 200 | 400, 404, 409 |
| 12 | DELETE | `/api/sales/:id` | Cancel a sale; stock restored | 204 | 400, 404 |
| 13 | GET | `/api/summary` | Dashboard KPIs | 200 | 400 |
| 14 | GET | `/api/summary/daily` | Revenue per day for the chart (stretch, 05 Section 9.2) | 200 | 400 |

The API validates inputs and returns JSON errors. Recording a sale and reducing stock happen together; the API rejects a sale when stock is insufficient.

Example:

```bash
curl -s "http://localhost:8000/api/summary?from=2026-10-01&to=2026-10-31"
```

## Database and sample data

The PostgreSQL schema and seed scripts are in [`database/`](database/). On a fresh database volume, the seed creates six categories, 24 products, and 200 sample sales. These figures are generated sample data for demonstration and analysis, not real store trading activity.

## Analytics and screenshots

The analytics deliverables include SQL analysis, a Power BI report, screenshots, and an insights report:

- [Insights report](analytics/insights_report.md)
- [KPI summary SQL](analytics/sql/kpi_summary.sql)
- [Insights analysis SQL](analytics/sql/insights_report.sql)
- [Power BI report](analytics/powerbi/campus-store.pbix)
- [App dashboard screenshot](analytics/screenshots/dashboard.png)
- [Products screenshot](analytics/screenshots/products.png)
- [Low-stock screenshot](analytics/screenshots/low-stock.png)
- [Record-sale screenshot](analytics/screenshots/record-sale.png)
- Power BI screenshots: [dashboard 1](analytics/powerbi/dashboard_1.png), [dashboard 2](analytics/powerbi/dashboard_2.png), [dashboard 3](analytics/powerbi/dashboard_3.png)

The report findings describe the seeded sample dataset. Monthly groupings can shift when the seed is run on a different date; review the insights report for its reporting period and limitations.

## Checks and CI

The backend integration tests require PostgreSQL and a separate database named `campus_store_test`. The tests refuse to reset a database unless its name ends in `_test`.

From the repository root, start PostgreSQL and connect to its default `postgres` database:

```powershell
docker compose up -d db
docker compose exec db psql -U store_admin -d postgres
```

At the `psql` prompt, create the test database once, then exit. If it already exists, skip the create command:

```sql
CREATE DATABASE campus_store_test;
\q
```

Then run the backend checks from the repository root. These example credentials match `.env.example`; if you changed them, use your local PostgreSQL username and password in `DATABASE_URL`.

```powershell
$env:DATABASE_URL = "postgresql://store_admin:local_secret_password@localhost:5432/campus_store_test"
Push-Location backend
npm ci
npm run lint
npm test
Pop-Location
```

GitHub Actions runs the backend lint and tests against PostgreSQL and checks the Docker Compose build on pull requests to `main`.

## Repository layout

```text
.github/       GitHub Actions CI
analytics/     SQL analysis, Power BI report, screenshots, and insights
backend/       Express API and backend tests
database/      PostgreSQL schema, seed data, and verification queries
dev_docs/      Requirements, API contract, architecture, and project decisions
docs/          Frontend and schema documentation
frontend/      React + Vite web application
docker-compose.yml  Local multi-service setup
.env.example   Example environment configuration
```
