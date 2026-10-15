# Campus Store Sales Tracker — Frontend

React and Vite frontend for the Campus Store Sales Tracker. It provides the dashboard, product management, sales entry/history, search and filters, and low-stock indicators from the API.

## Run locally

Use a terminal in the `frontend` directory (not VS Code Live Server):

```powershell
npm install
npm start
```

Then open <http://localhost:3000>. The `start` script launches Vite on port 3000. Keep that terminal open while using the app; press `Ctrl+C` there to stop it.

Vite proxies `/api` requests to `http://localhost:8000` by default. Start the backend separately, or set `API_PROXY_TARGET` to its URL. The browser-facing API base defaults to `/api` (`VITE_API_URL`). For the full stack, follow the repository's Docker Compose instructions.

## Checks

```powershell
npm run lint
npm run build
```

## Frontend conventions

- The frontend consumes the backend API; it does not calculate stock status. Display the API's `is_low_stock` value.
- Format prices as Ghanaian cedi (for example, `GHS 1,234.50`).
- Show loading, empty, retryable error, and form validation states.
- Keep configuration in environment variables; only `VITE_*` variables are exposed to browser code. `API_PROXY_TARGET` is used by Vite's server proxy and is not a browser variable.

See [`../docs/frontend-technical-documentation.md`](../docs/frontend-technical-documentation.md) and [`../dev_docs/05-api-reference.md`](../dev_docs/05-api-reference.md) for the frontend feature and API contracts.
