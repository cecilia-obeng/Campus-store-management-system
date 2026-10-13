# 05. API Reference (REST Contract)

| | |
|---|---|
| **Owner** | Joseph (Backend) |
| **Consumers** | Cecilia (frontend), Samuel (reconciliation), Postman tests |
| **Machine-readable spec** | [openapi.yaml](openapi.yaml) (OpenAPI 3.0; load into Swagger UI or Postman) |
| **Base URL** | Docker or local: `http://localhost:8000/api` · through the frontend dev proxy: `/api` |
| **Status** | **Frozen v1.0** (13 Oct 2026). Changes follow [02 §5](02-team-workflow-and-repo-structure.md#5-changing-an-agreed-contract). |

The endpoint list matches Cecilia's frontend technical design (§5) exactly. It adds the query parameters, request and response shapes, and error codes that the design left to this contract. Stretch endpoints are listed separately in §9.

---

## Endpoint index

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
| 10 | POST | `/api/sales` | Record a sale; **stock decreases** | 201 | 400, 404, 409 |
| 11 | PUT | `/api/sales/:id` | Correct a sale; **stock adjusts by the difference** | 200 | 400, 404, 409 |
| 12 | DELETE | `/api/sales/:id` | Cancel a sale; **stock restored** | 204 | 400, 404 |
| 13 | GET | `/api/summary` | Dashboard KPIs | 200 | 400 |

---

## 1. Conventions

| Topic | Rule |
|-------|------|
| Format | JSON request and response bodies; send `Content-Type: application/json` |
| Field names | `snake_case`, same as the DB columns |
| IDs | Positive integers. A non-integer `:id` (e.g. `/api/products/abc`) → 400 `VALIDATION_ERROR` |
| Money | JSON **numbers** with up to 2 decimals (`85`, `4.5`, `12549.5`). Never strings. Display formatting (`GHS 1,234.50`) is the frontend's job. |
| Date-times in responses | ISO 8601 UTC strings: `"2026-10-12T11:05:00.000Z"` |
| Date filters in queries | `YYYY-MM-DD`. `from` is inclusive from 00:00 UTC; `to` is inclusive through the end of that day (`sale_date < to + 1 day`) |
| Single resource | `{ "data": { … } }` |
| List | `{ "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 134 } }` |
| Delete | `204 No Content`, empty body |
| Pagination | `page` (default 1, ≥ 1), `limit` (default 20, 1–100) |
| Unknown body fields | **Ignored** (stripped by validation), so they can't cause harm |
| Unknown query params | Ignored |
| Strings | Trimmed before validation and storage |
| Auth | None in v1 (stretch: §9.3) |
| CORS | Allowed origins from `CORS_ORIGIN` (default `http://localhost:3000,http://localhost:5173`) |

### Status codes
| Code | When |
|------|------|
| 200 | Successful GET or PUT |
| 201 | Successful POST |
| 204 | Successful DELETE |
| 400 | Validation failed, bad query params, malformed JSON |
| 404 | Resource id doesn't exist, or unknown route |
| 409 | Duplicate name; not enough stock; deleting something in use |
| 500 | Unexpected error (generic message; details only in server logs) |
| 503 | `/api/health` when the database is unreachable |

---

## 2. Error format

**Every** error response, from any endpoint, has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid.",
    "details": [
      { "field": "price", "message": "Price must be 0 or more." },
      { "field": "name",  "message": "Name is required." }
    ]
  }
}
```

| `code` | HTTP | Example `message` | `details`? |
|--------|------|-------------------|:----------:|
| `VALIDATION_ERROR` | 400 | "Request body is invalid." / "Query parameters are invalid." / "Category 99 does not exist." | yes |
| `INVALID_JSON` | 400 | "Request body is not valid JSON." | no |
| `NOT_FOUND` | 404 | "Product 99 was not found." / "Sale 512 was not found." | no |
| `ROUTE_NOT_FOUND` | 404 | "GET /api/prodcts does not exist." | no |
| `DUPLICATE` | 409 | "A product named 'Cola 330ml' already exists." | no |
| `INSUFFICIENT_STOCK` | 409 | "Only 3 units of 'USB Flash Drive 32GB' in stock; cannot sell 5." | yes, see below |
| `IN_USE` | 409 | "Product 4 has 12 sales and cannot be deleted." | no |
| `INTERNAL_ERROR` | 500 | "Something went wrong. Please try again." | no |

`INSUFFICIENT_STOCK` includes machine-readable figures so the UI can show "available: 3":

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 3 units of 'USB Flash Drive 32GB' in stock; cannot sell 5.",
    "details": [ { "field": "quantity", "message": "Only 3 available.", "available": 3, "requested": 5 } ]
  }
}
```

**Frontend rule:** show `error.message` as the page or form message, and put each `details[].message` under the input named by `details[].field`.

---

## 3. Health

### 3.1 `GET /api/health`
Used by Docker, CI and the frontend to check that the API and the database are up.

**200**
```json
{ "status": "ok", "database": "ok" }
```
**503**
```json
{ "status": "error", "database": "unreachable" }
```
The health response deliberately doesn't use the `{ data }` envelope. It is an infrastructure probe.

```bash
curl http://localhost:8000/api/health
```

---

## 4. Categories

### 4.1 Category object
```json
{ "id": 3, "name": "Electronics", "description": null, "product_count": 4 }
```
| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | n/a |
| `name` | string | n/a |
| `description` | string \| null | the seed leaves it null |
| `product_count` | integer | number of products in the category |

### 4.2 `GET /api/categories`
Returns **all** categories, ordered by `name`. Not paginated: there are only a few.

**200**
```json
{
  "data": [
    { "id": 1, "name": "Beverages", "description": null, "product_count": 4 },
    { "id": 2, "name": "Campus Merchandise", "description": null, "product_count": 4 }
  ]
}
```
Category create, update and delete are **not in v1** (categories come from the seed). See §9.4 if they're needed.

---

## 5. Products

### 5.1 Product object
```json
{
  "id": 10,
  "name": "USB Flash Drive 32GB",
  "category_id": 3,
  "category_name": "Electronics",
  "price": 75,
  "stock_quantity": 34,
  "reorder_level": 10,
  "is_low_stock": false,
  "created_at": "2026-10-13T08:00:00.000Z",
  "updated_at": "2026-10-13T08:00:00.000Z"
}
```
| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | n/a |
| `name` | string | unique, case-insensitive |
| `category_id` | integer | n/a |
| `category_name` | string | joined from `categories` |
| `price` | number | current selling price, 2 dp |
| `stock_quantity` | integer | ≥ 0 |
| `reorder_level` | integer | the product's own low-stock threshold |
| `is_low_stock` | boolean | **calculated by the API: `stock_quantity <= reorder_level`** |
| `created_at`, `updated_at` | string (ISO) | n/a |

There is **no** `is_active` field in v1.

### 5.2 `GET /api/products`

| Query param | Type | Default | Meaning |
|-------------|------|---------|---------|
| `search` | string (1–100) | n/a | name contains this text, case-insensitive. `%` and `_` are treated literally. |
| `category_id` | integer | n/a | only this category |
| `low_stock` | `true` \| `false` | n/a | `true` = only low-stock products; `false` = only not-low-stock |
| `sort` | enum | `name` | `name`, `-name`, `price`, `-price`, `stock_quantity`, `-stock_quantity`, `created_at`, `-created_at` (`-` = descending). The tie-breaker is always `id`. |
| `page` | integer ≥ 1 | 1 | n/a |
| `limit` | integer 1–100 | 20 | n/a |

Filters combine with AND: `?search=usb&category_id=3&low_stock=true`.

**200**
```json
{
  "data": [ { "id": 10, "name": "USB Flash Drive 32GB", "category_id": 3, "category_name": "Electronics", "price": 75, "stock_quantity": 34, "reorder_level": 10, "is_low_stock": false, "created_at": "…", "updated_at": "…" } ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```
**400** `VALIDATION_ERROR` if `category_id` isn't an integer, `sort` isn't allowed, `limit` > 100, and so on. A `category_id` that doesn't exist simply returns an empty list.

```bash
curl "http://localhost:8000/api/products?search=usb&low_stock=false&sort=-price"
```

> Tip for the sale form's product dropdown: `GET /api/products?limit=100&sort=name` returns the whole seeded catalogue (24 products) in one call.

### 5.3 `GET /api/products/:id`
**200** `{ "data": <product> }` · **400** bad id · **404** `NOT_FOUND`

### 5.4 `POST /api/products`
**Request**
```json
{ "name": "Pilot Pen Blue", "category_id": 6, "price": 4.5, "stock_quantity": 120, "reorder_level": 20 }
```

| Field | Required | Rule | Error message |
|-------|:--------:|------|---------------|
| `name` | ✅ | string, trimmed, 2–100 chars | "Name is required." / "Name must be 2 to 100 characters." |
| `category_id` | ✅ | positive integer; **category must exist** | "Category is required." / "Category 99 does not exist." |
| `price` | ✅ | number, 0 – 99,999,999.99, at most 2 decimals | "Price must be 0 or more." / "Price can have at most 2 decimal places." |
| `stock_quantity` | ✅ | integer ≥ 0 | "Stock quantity must be a whole number, 0 or more." |
| `reorder_level` | ❌ | integer ≥ 0; **default 10** | "Reorder level must be a whole number, 0 or more." |

**201** `{ "data": <product> }`, with a `Location: /api/products/{id}` header
**400** `VALIDATION_ERROR` (with `details`)
**409** `DUPLICATE`: "A product named 'Pilot Pen Blue' already exists." (case-insensitive)

```bash
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Pilot Pen Blue","category_id":6,"price":4.5,"stock_quantity":120}'
```

### 5.5 `PUT /api/products/:id`
A full replacement. The body and rules are the **same as POST**, and every required field must be sent. If `reorder_level` is omitted, it resets to 10, so the frontend should always send the current value.

Changing `price` **doesn't** affect past sales; each sale keeps its own `unit_price`.

Changing `stock_quantity` here is how the manager records a delivery or a stock count.

**200** `{ "data": <product> }` (with a new `updated_at`) · **400** · **404** · **409** `DUPLICATE`

### 5.6 `DELETE /api/products/:id`
**204** · **400** bad id · **404** `NOT_FOUND`
**409** `IN_USE`: "Product 4 has 12 sales and cannot be deleted." Products with sales are protected by the database (`ON DELETE RESTRICT`). Only products that have never been sold can be deleted.

---

## 6. Sales

### 6.1 Sale object
```json
{
  "id": 201,
  "product_id": 10,
  "product_name": "USB Flash Drive 32GB",
  "category_id": 3,
  "category_name": "Electronics",
  "quantity": 2,
  "unit_price": 75,
  "total": 150,
  "payment_method": "mobile_money",
  "sale_date": "2026-10-13T11:05:00.000Z",
  "created_at": "2026-10-13T11:05:02.114Z"
}
```
| Field | Type | Notes |
|-------|------|-------|
| `unit_price` | number | price **at the time of sale** (copied by the server) |
| `total` | number | `quantity × unit_price`, calculated by the API, not stored |
| `payment_method` | enum | `cash`, `mobile_money`, `card` |
| `sale_date` | string (ISO) | when the sale happened |
| `created_at` | string (ISO) | when it was recorded |

### 6.2 `GET /api/sales`
| Query param | Type | Default | Meaning |
|-------------|------|---------|---------|
| `from` | `YYYY-MM-DD` | n/a | `sale_date >= from 00:00 UTC` |
| `to` | `YYYY-MM-DD` | n/a | `sale_date < (to + 1 day) 00:00 UTC` (includes the whole day) |
| `product_id` | integer | n/a | only this product |
| `category_id` | integer | n/a | only products in this category |
| `payment_method` | enum | n/a | `cash` \| `mobile_money` \| `card` |
| `sort` | enum | `-sale_date` | `sale_date`, `-sale_date`, `total`, `-total` |
| `page`, `limit` | integer | 1, 20 | n/a |

**400** if `from` > `to`, a date is badly formed, or an enum is invalid.

**200** list response of sale objects, newest first by default.

```bash
curl "http://localhost:8000/api/sales?from=2026-10-01&to=2026-10-13&payment_method=cash"
```

### 6.3 `GET /api/sales/:id`
**200** `{ "data": <sale> }` · **400** · **404**

### 6.4 `POST /api/sales`: record a sale
**Request**
```json
{ "product_id": 10, "quantity": 2, "payment_method": "mobile_money", "sale_date": "2026-10-13T11:05:00Z" }
```

| Field | Required | Rule |
|-------|:--------:|------|
| `product_id` | ✅ | positive integer; product must exist (**404** if not) |
| `quantity` | ✅ | integer ≥ 1 (max 10,000) |
| `payment_method` | ✅ | `cash` \| `mobile_money` \| `card` |
| `sale_date` | ❌ | ISO 8601 date-time **with seconds and a zone**, e.g. `2026-10-13T11:05:00Z` or `…+00:00`; **not in the future** (5-minute tolerance); default = now. From a `datetime-local` input, send `new Date(value).toISOString()`. |
| `unit_price`, `total` | 🚫 | **ignored if sent.** The server copies the product's current `price`. |

**What happens, in one transaction:**
1. `stock_quantity` is decreased by `quantity` **only if** `stock_quantity >= quantity` (one atomic statement).
2. If no row was updated: 404 if the product doesn't exist, otherwise 409 `INSUFFICIENT_STOCK`. **Nothing is saved.**
3. The sale is inserted with `unit_price = products.price`.
4. Commit. Any failure rolls back both steps.

**201**: the sale, plus two extra fields the UI uses for an immediate low-stock warning:
```json
{
  "data": {
    "id": 201, "product_id": 10, "product_name": "USB Flash Drive 32GB",
    "category_id": 3, "category_name": "Electronics",
    "quantity": 2, "unit_price": 75, "total": 150,
    "payment_method": "mobile_money",
    "sale_date": "2026-10-13T11:05:00.000Z", "created_at": "2026-10-13T11:05:02.114Z",
    "product_stock_after": 32,
    "is_low_stock": false
  }
}
```
**400** `VALIDATION_ERROR` · **404** `NOT_FOUND` (product) · **409** `INSUFFICIENT_STOCK`

### 6.5 `PUT /api/sales/:id`: correct a sale
A partial update. Send **at least one** of:

| Field | Rule |
|-------|------|
| `quantity` | integer ≥ 1 |
| `payment_method` | `cash` \| `mobile_money` \| `card` |
| `sale_date` | ISO date-time, not in the future |

**Not changeable:** `product_id` and `unit_price`. To change the product, cancel the sale and record a new one. If either is sent → 400 `VALIDATION_ERROR` ("Product cannot be changed; cancel the sale and record a new one.").

**Stock adjusts by the difference**, in one transaction:
- 2 → 5: stock decreases by 3 more (409 `INSUFFICIENT_STOCK` if fewer than 3 are available; nothing changes)
- 5 → 2: stock increases by 3
- quantity unchanged: no stock change

**200** `{ "data": <sale + product_stock_after + is_low_stock> }` · **400** · **404** · **409**

### 6.6 `DELETE /api/sales/:id`: cancel a sale
Deletes the sale **and returns its quantity to stock**, in one transaction. The cancelled sale isn't kept (accepted for v1; see [10](10-decisions-and-alignment-log.md)). The frontend should ask for confirmation.

**204** · **400** · **404**

---

## 7. Summary (dashboard KPIs)

### 7.1 `GET /api/summary`
| Query param | Meaning |
|-------------|---------|
| `from`, `to` | Optional `YYYY-MM-DD` range, same rules as `/api/sales`. Omit both for all time. |

**200**. This is the real output from a seeded test database on 13 Oct 2026. Your revenue figures may differ until the seed fix in [04 §5](04-database-schema.md#5-seed-data-databaseseedsql) lands; orders and units will match.
```json
{
  "data": {
    "period": { "from": null, "to": null },
    "total_revenue": 12044,
    "total_orders": 200,
    "average_order_value": 60.22,
    "total_units_sold": 402,
    "low_stock_count": 0,
    "top_products": [
      { "product_id": 7,  "product_name": "Campus Hoodie",        "category_name": "Campus Merchandise", "units_sold": 20, "revenue": 2900 },
      { "product_id": 11, "product_name": "USB Flash Drive 32GB", "category_name": "Electronics",        "units_sold": 17, "revenue": 1275 },
      { "product_id": 9,  "product_name": "Phone Wall Charger",   "category_name": "Electronics",        "units_sold": 13, "revenue": 1105 },
      { "product_id": 8,  "product_name": "Campus T-Shirt",       "category_name": "Campus Merchandise", "units_sold": 15, "revenue": 975 },
      { "product_id": 10, "product_name": "Wired Earphones",      "category_name": "Electronics",        "units_sold": 21, "revenue": 945 }
    ]
  }
}
```

### 7.2 Metric definitions (identical in the API, SQL and Power BI)
| Metric | Definition |
|--------|-----------|
| `total_revenue` | Σ(`quantity × unit_price`) over sales in the period, rounded to 2 dp **at the end** |
| `total_orders` | number of rows in `sales` in the period |
| `average_order_value` | `total_revenue ÷ total_orders`, rounded to 2 dp; **0 when there are no orders** |
| `total_units_sold` | Σ(`quantity`) in the period |
| `low_stock_count` | products with `stock_quantity <= reorder_level` **now** (ignores the period) |
| `top_products` | up to 5 products with the highest revenue in the period; ties broken by `product_name` A→Z; only products with sales in the period |
| period | `sale_date >= from` (00:00 UTC) and `sale_date < to + 1 day` |

**400** if a date is invalid or `from` > `to`.

---

## 8. Field rules quick reference

| Field | Type | Rule |
|-------|------|------|
| product `name` | string | trimmed, 2–100 chars, unique (case-insensitive) |
| `category_id` | int | > 0, must exist |
| `price` | number | 0 – 99,999,999.99, ≤ 2 dp |
| `stock_quantity` | int | ≥ 0 |
| `reorder_level` | int | ≥ 0, default 10 |
| `product_id` | int | > 0, must exist |
| `quantity` | int | 1 – 10,000 |
| `payment_method` | enum | `cash`, `mobile_money`, `card` |
| `sale_date` | ISO date-time | not in the future (5-minute tolerance) |
| `from`, `to` | `YYYY-MM-DD` | `from` ≤ `to` |
| `page` | int | ≥ 1 |
| `limit` | int | 1–100 |

---

## 9. Stretch endpoints (only after every Must is Done)

These are not in Cecilia's v1 list. They are defined now so the frontend and backend agree if there is time to build them.

### 9.1 `GET /api/sales/export.csv` (FR-60)
The same filters as `GET /api/sales` (no pagination). Returns `text/csv` with `Content-Disposition: attachment; filename="sales-YYYY-MM-DD.csv"`.
Columns: `id,sale_date,product_id,product_name,category_name,quantity,unit_price,total,payment_method`.
> Route order matters: register `/sales/export.csv` **before** `/sales/:id`.

### 9.2 `GET /api/summary/daily?days=7` (FR-61)
`days` 1–90, default 7. Includes days with zero sales, oldest first, ending today (UTC).
```json
{ "data": [ { "date": "2026-10-07", "revenue": 512, "orders": 9 }, { "date": "2026-10-08", "revenue": 0, "orders": 0 } ] }
```

### 9.3 `POST /api/auth/login` (FR-62)
`{ "username": "admin", "password": "…" }` → `200 { "data": { "token": "<JWT>", "user": { "id": 1, "username": "admin", "role": "admin" } } }` · `401 UNAUTHORIZED`.
Then send `Authorization: Bearer <token>` on every request. **admin** can do everything; **cashier** can view everything and `POST /api/sales`, but nothing else that writes (`403 FORBIDDEN`). This needs a `users` table (schema change request to Samuel).

### 9.4 Category management (optional)
`POST /api/categories`, `PUT /api/categories/:id` (`{ name, description? }`; 409 `DUPLICATE`), and `DELETE /api/categories/:id` (409 `IN_USE` if it has products).

---

## 10. Postman / curl smoke test

The collection lives at `backend/campus-store.postman_collection.json`. Minimum cases:

- [ ] `GET /health` → 200 `ok`
- [ ] `POST /products` valid → 201; the same name in different case → 409 `DUPLICATE`
- [ ] `POST /products` with `price: -1` → 400 with `details[0].field = "price"`
- [ ] `POST /products` with `category_id: 999` → 400
- [ ] `GET /products/99999` → 404; `GET /products/abc` → 400
- [ ] `?search=usb`, `?category_id=1`, `?low_stock=true`, `?sort=-price` all work, alone and together
- [ ] `POST /sales` qty 2 → 201, and the product's stock is 2 lower
- [ ] `POST /sales` qty > stock → 409, and stock is **unchanged**
- [ ] `POST /sales` with `payment_method: "bitcoin"` → 400
- [ ] `POST /sales` with `unit_price: 0.01` → 201, but `unit_price` = the product price
- [ ] `PUT /sales/:id` qty up and down → stock adjusts by the difference
- [ ] `DELETE /sales/:id` → 204, stock restored
- [ ] `DELETE /products/:id` with sales → 409 `IN_USE`
- [ ] `GET /summary` on a fresh DB → orders 200, units 402, and revenue and AOV equal to `analytics/sql/kpi_summary.sql` on the same DB
- [ ] `GET /api/nope` → 404 JSON `ROUTE_NOT_FOUND`
- [ ] Broken JSON body → 400 `INVALID_JSON`
