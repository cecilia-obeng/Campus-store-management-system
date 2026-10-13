Campus Store Sales Tracker
Frontend Technical Design
Owner: Cecilia
Status: Proposed
Last updated: 12 October 2026
1. Purpose
The frontend is a responsive web app for campus store staff to manage products, record sales, monitor stock, and review sales performance. It communicates with the backend REST API; the API is responsible for saving data and enforcing business rules such as stock deductions.
2. Technology
- React with Vite
- JavaScript
- CSS
- Fetch API for backend requests
- Git and GitHub for version control and collaboration
3. Scope and features
Dashboard
- Show total revenue, total orders, average order value, and the top five products using GET /api/summary.
- Show loading, empty, and error states.
Product management
- List and search products by name; filter by category.
- Add, view, edit, and delete products.
- Display each product’s name, category, price, stock quantity, and active status.
- Mark a product as low stock when stock_quantity < reorder_level.
Sales management
- Record a sale with one product, quantity, sale date, and payment method.
- View sales history and sale details.
- Allow an authorized staff member to correct or cancel a sale using the API.
- Explain the effect of cancellation: the backend restores the sold quantity to stock.
Categories
- Load categories for product filters and forms.
4. Data assumptions
The current proposed database model has categories, products, and sales tables. Each sale record contains one product and its quantity; there is no separate sales_items table.
The frontend uses these agreed field names:
- Product low-stock threshold: reorder_level, maintained per product.
- Sale timestamp: sale_date.
The frontend displays the threshold returned by the API and does not assume it is always 10.
5. API integration
The frontend uses the following routes. Request and response details, including pagination and error response shapes, should follow the API contract agreed with the backend owner.
Method	Endpoint	Frontend use
GET	/api/health	Check whether the API is available
GET	/api/categories	Load categories for filters and forms
GET	/api/products	List, search, and filter products
GET	/api/products/:id	Load a product for viewing or editing
POST	/api/products	Create a product
PUT	/api/products/:id	Update a product
DELETE	/api/products/:id	Delete a product
GET	/api/sales	Show sales history
GET	/api/sales/:id	Show sale details
POST	/api/sales	Record a sale
PUT	/api/sales/:id	Correct a sale, according to backend rules
DELETE	/api/sales/:id	Cancel a sale and restore stock
GET	/api/summary	Load dashboard metrics


6. Forms and error handling
The frontend provides clear labels, required-field indicators, and basic input checks before submitting forms. The backend remains the source of truth for validation.
For API requests, the UI displays:
- A loading state while data is being fetched or saved.
- A success message after a successful create, update, or cancellation.
- A readable error message when validation fails or the API is unavailable.
- An empty state when a list or dashboard has no data.
Sale submission should prevent repeated clicks while the request is in progress. The frontend should show the backend’s insufficient-stock error clearly and refresh affected product and dashboard data after a successful sale or cancellation.
7. Development and configuration
The frontend calls the API through a configurable base URL so it can work in local development and in Docker. In the deployed setup, requests use the same-origin /api path through the frontend proxy.
8. Current status and next steps
The repository, collaborators, and frontend development branch are in place. Next, confirm API request/response formats with the backend owner, then build the product list and forms, sales flow, and dashboard.
9. Expected outcome
A usable interface that lets campus store staff manage products, record and review sales, identify low-stock products, and understand key sales metrics.

