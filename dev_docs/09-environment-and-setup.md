# 09. Environment and Setup

| | |
|---|---|
| **Owner** | Nana Yaw (DevOps) |
| **Current state** | Merged to `main` in PR #1 (`d1a8f5e`): `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example`, `.github/workflows/ci.yml` |
| **Status** | §1–3 describe what exists. §4–5 list agreed changes for the DevOps owner. |

---

## 1. Run the whole system

```bash
git clone https://github.com/cecilia-obeng/Campus-store-management-system.git
cd Campus-store-management-system
cp .env.example .env              # PowerShell: Copy-Item .env.example .env
docker compose up --build
```

| What | URL |
|------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:8000/api/health |
| Database (psql, pgAdmin, Power BI) | `localhost:5432`, db `campus_store`, user from `.env` |

| Task | Command |
|------|---------|
| Stop (keep data) | `docker compose down` |
| **Reset DB** (re-runs schema and seed) | `docker compose down -v && docker compose up --build` |
| Logs | `docker compose logs -f backend` (or `db`, `frontend`) |
| SQL shell | `docker compose exec db psql -U store_admin -d campus_store` |

---

## 2. Services (as merged on `main`)

| Service | Image / build | Host port | Notes |
|---------|---------------|-----------|-------|
| `db` | `postgres:15-alpine` | 5432 | Data in volume `postgres_data`; `./database` is mounted as the init folder |
| `backend` | `./backend` (Node 20) | 8000 | Runs `npm run dev`; source is bind-mounted for hot reload |
| `frontend` | `./frontend` (Node 20) | 3000 | Runs `npm start` (the Vite dev server) |

**Database initialisation:** on the **first** start with an empty volume, Postgres runs every `*.sql` in `./database` **in alphabetical order** (`init.sql` → `seed.sql` → `verify.sql`). These scripts never run again on that volume. To start over, reset the volume. Only files meant to run at creation belong in `database/`; analysis SQL goes in `analytics/sql/`.

**Hostnames:** inside Compose, services reach each other by service name (`db:5432`, `backend:8000`). From your laptop, use `localhost`.

---

## 3. Environment variables

`.env` lives in the repo root and is **git-ignored**. `.env.example` is the committed template, with placeholders only.

| Variable | Used by | Value / example | Notes |
|----------|---------|-----------------|-------|
| `POSTGRES_USER` | db | `store_admin` | n/a |
| `POSTGRES_PASSWORD` | db | *(your own)* | Never commit a real one |
| `POSTGRES_DB` | db | `campus_store` | n/a |
| `DATABASE_URL` | backend | `postgresql://store_admin:<password>@db:5432/campus_store` | Use `localhost` instead of `db` when running Node outside Docker |
| `PORT` | backend | `8000` | n/a |
| `NODE_ENV` | backend | `development` / `test` / `production` | To be added (C3) |
| `CORS_ORIGIN` | backend | `http://localhost:3000,http://localhost:5173` | To be added (C3) |
| `VITE_API_URL` | frontend | `/api` | Replaces `REACT_APP_API_URL` / `NEXT_PUBLIC_API_URL` (C1) |
| `API_PROXY_TARGET` | frontend dev server | `http://backend:8000` | Where Vite forwards `/api` requests (C1) |

---

## 4. CI pipeline

**Current:** on every PR to `main`, CI installs the backend and frontend dependencies and runs `docker compose build`.

**Agreed target** (the brief: "runs checks on each pull request"):

| Job | Checks |
|-----|--------|
| backend | `npm ci`, `npm run lint`, `npm test` against a Postgres service container |
| database | `init.sql` → `seed.sql` → `verify.sql` run cleanly on an empty Postgres 15 |
| frontend | install, lint, `npm run build` |
| docker | `docker compose build`, start the stack, `GET /api/health` returns 200 |

Then branch protection on `main` requires a PR, one approval and all four checks.

---

## 5. Agreed change requests (DevOps owner)

| # | Change | Why | Priority |
|---|--------|-----|----------|
| C1 | Frontend env var → **`VITE_API_URL`**; add `API_PROXY_TARGET=http://backend:8000` | Vite only reads `VITE_*` variables | 🔴 before integration |
| C2 | DB healthcheck + backend `depends_on: condition: service_healthy` | The backend shouldn't start before Postgres is ready | 🟠 |
| C3 | Pass `NODE_ENV` and `CORS_ORIGIN` to the backend | Needed by the backend config | 🟠 |
| C4 | Write `DATABASE_URL` out literally in `.env.example` (no nested `${…}`) | Interpolation inside `.env` isn't reliable | 🟠 |
| C5 | `npm ci` in Dockerfiles once lockfiles exist; add `.dockerignore` files | Reproducible builds; keep `.env` and `node_modules` out of images | 🟡 |
| C6 | Remove `version: '3.8'` from Compose | Obsolete; prints a warning | 🟡 |
| C7 | CI jobs from §4, marked as required checks | Graded under Deployment & CI | 🟠 |

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `port is already allocated` on 5432 | Stop the local Postgres, or map `"5433:5432"` |
| Tables missing / seed didn't run | The volume already existed. Run `docker compose down -v && docker compose up --build`. |
| Seed error "requires empty … tables" | Expected on a populated DB. Reset the volume instead of re-running it. |
| Backend logs `ECONNREFUSED db:5432` at start | Postgres is still starting. Wait (fixed properly by C2). |
| Frontend calls go to `undefined/api/...` | The env var isn't prefixed `VITE_` (C1) |
| New npm package not picked up in Docker | `docker compose up --build <service>` |
