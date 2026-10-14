# Campus Store Sales Tracker
## Frontend Technical Design

| | |
|---|---|
| Owner | Cecilia |
| Status | Frontend implementation in progress |
| Updated | 14 October 2026 |

## 1. Purpose

The React frontend lets campus store staff review sales, manage products, record sales, and monitor stock. The REST API is the source of truth for saved data and business rules.

## 2. Technology and navigation

- React, Vite, JavaScript, and CSS.
- Fetch API for same-origin requests under /api.
- Hash routes: #/overview, #/products, and #/sales; browser back and forward navigation are supported.
- Vite serves the frontend on port 3000. Its development proxy sends /api requests to API_PROXY_TARGET.

## 3. Frontend behavior

### Overview

- Requests GET /api/summary, with optional from and to dates, for revenue, order count, average order value, low-stock count, and top products.
- Requests GET /api/summary/daily?days=7 for the seven-day revenue chart.
- Displays sample figures only when the API is unavailable; sample data is labelled as demo data.

### Products

- Loads GET /api/products?limit=100.
- Shows product cards with name, category, GHS price, stock, and the API-provided is_low_stock flag.
- Supports debounced name search, category filtering, and a low-stock-only filter.
- Add, edit, and delete forms call the corresponding product endpoints when connected.
- is_low_stock is never recalculated in the frontend. The API defines it as stock_quantity <= reorder_level.

### Sales

- Loads GET /api/sales with date, product, and payment-method filters.
- Records sales with product, quantity, date, and payment method. The request does not set the sale price; the API copies the current product price and deducts stock transactionally.
- Supports correcting and cancelling sales through the API. Cancellation asks for confirmation.
- In demo mode, changes are held in React state for the current browser session only; the demo does not change inventory.

### Loading and errors

- Product, sales, and summary requests show loading, error, retry, and empty states.
- Form errors display the API's human-readable error message.
- Save buttons are disabled while a request is in progress.

## 4. API requests used

| Method | Endpoint | Frontend use |
|---|---|---|
| GET | /api/products?limit=100 | Initial product list |
| POST | /api/products | Create product |
| PUT | /api/products/:id | Replace product fields |
| DELETE | /api/products/:id | Delete product |
| GET | /api/sales | Sales history with supported filters |
| POST | /api/sales | Record sale |
| PUT | /api/sales/:id | Correct sale |
| DELETE | /api/sales/:id | Cancel sale |
| GET | /api/summary | Dashboard KPIs and top products |
| GET | /api/summary/daily?days=7 | Revenue chart |

Category choices are derived from product data, with the agreed sample categories available in demo mode. The frontend does not currently call /api/categories, /api/health, /api/products/:id, or /api/sales/:id.

## 5. Data contract

Product samples match the API product object: id, name, category_id, category_name, price, stock_quantity, reorder_level, is_low_stock, created_at, and updated_at.

Sale samples match the API sale object: id, product_id, product_name, category_id, category_name, quantity, unit_price, total, payment_method, sale_date, and created_at.

Prices display in Ghana cedis, for example GHS 1,234.50. Accepted payment values are cash, mobile_money, and card.

## 6. Configuration and runtime

- Browser API path: VITE_API_URL, default /api.
- Vite proxy target: API_PROXY_TARGET, default http://localhost:8000; Compose supplies http://backend:8000.
- The browser uses the same-origin /api path, avoiding a browser CORS dependency in the Vite proxy setup.
- npm start serves Vite on port 3000.

## 7. Current status and dependencies

The frontend routes, product cards and forms, sales forms/history, local search and filters, API request handlers, dashboard summary UI, and daily chart UI are implemented. The frontend can run in demo mode while the API is unavailable.

Live API behavior is not yet confirmed: the available backend branch currently contains only a placeholder server. The summary and daily chart depend on Joseph's corresponding endpoints. Running the full app with Docker Compose and confirming the frontend proxy depends on Nana Yaw's DevOps setup.

The production build and frontend lint have passed locally. A live API run and Docker Compose demonstration remain outstanding.
