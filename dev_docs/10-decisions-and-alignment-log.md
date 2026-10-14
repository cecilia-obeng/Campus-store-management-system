# 13. Decisions and Alignment Log

| | |
|---|---|
| **Maintainer** | Joseph |
| **Rule** | Decisions are never edited away. A changed decision gets a new entry that **supersedes** the old one. |
| **Status** | v1.0 (13 Oct 2026) |

---

## 1. Product and data decisions

| ID | Decision | Rationale | Agreed by | Status |
|----|----------|-----------|-----------|--------|
| D-01 | **Low stock = `stock_quantity <= reorder_level`** ("at or below") | Already implemented in Samuel's `verify.sql` and database README; it is the standard reorder-point meaning. The API calculates `is_low_stock`, so the frontend only displays it. **Supersedes** the `<` in the frontend design and the earlier API draft. | Joseph, Samuel, Cecilia (acknowledged 13 Oct 2026) | Accepted |
| D-02 | One sale = one product line; order = one `sales` row | Brief; keeps the KPIs simple | All | Accepted |
| D-03 | `sales.unit_price` snapshots the product price; the client can't send a price | Past revenue stays stable; prevents tampering | All | Accepted |
| D-04 | Cancelling a sale **deletes** it and restores stock (no `status`) | Avoids a `status` filter in every KPI query (the app and Power BI could disagree). Trade-off: no cancellation history. | Joseph, Samuel | Accepted (v1) |
| D-05 | No `is_active`; a sold product can't be deleted (409 `IN_USE`) | Simpler v1; history protected by `ON DELETE RESTRICT` | Joseph, Samuel | Accepted (v1) |
| D-06 | Product names unique **globally**, case-insensitive | FR-07; the API maps `23505` → 409 | Joseph, Samuel | Accepted |
| D-07 | `INTEGER` identity keys named `id` | `pg` returns `BIGINT` as strings | Joseph, Samuel | Accepted |
| D-08 | Currency GHS, 2 dp; times UTC (= Ghana) | Single store in Ghana | All | Accepted (mentor to confirm) |
| D-09 | KPI definitions in [05 §7.2](05-api-reference.md#72-metric-definitions-identical-in-the-api-sql-and-power-bi) are the single source for the API, SQL and Power BI | Reconciliation deliverable | Joseph, Samuel | Accepted |
| D-10 | Keep Samuel's file layout `database/init.sql`, `seed.sql`, `verify.sql` (not `database/init/01_schema.sql`) | Works with the merged Compose mount; alphabetical run order is correct | Joseph, Samuel, Nana Yaw | Accepted |

## 2. Architecture decisions (ADRs)

| ID | Decision | Why | Consequences |
|----|----------|-----|--------------|
| ADR-001 | **Node.js 20 + Express 5** | Node 20 is pinned in the merged Dockerfile. Express 5 forwards async errors automatically. Same language as the frontend. (Supersedes the "Node 24" draft.) | Layering is self-imposed (ADR-007) |
| ADR-002 | `pg` with hand-written parameterised SQL, no ORM | API SQL is comparable line by line with the analytics SQL; full transaction control; one schema owner | Must convert `NUMERIC`/`BIGINT` strings; must whitelist `ORDER BY` |
| ADR-003 | zod 4 for validation | One schema validates, converts and gives per-field messages | Use v4 syntax (`{ error: … }`) |
| ADR-004 | **Guarded `UPDATE … WHERE stock_quantity >= qty`** inside a transaction for sales; `SELECT … FOR UPDATE` for corrections | Prevents overselling under concurrency in one atomic statement. **Verified:** 10 parallel sales against stock 3 gave exactly 3 successes. | Explain it in the PR and the demo |
| ADR-005 | One error shape `{ error: { code, message, details? } }`, built only by `errorHandler` | Predictable for the frontend; no leaked internals | Postgres codes are mapped centrally (`23505`, `23001`, `23503`, `23514`) |
| ADR-006 | Price snapshot on sale (= D-03) | n/a | Corrections never change `unit_price` |
| ADR-007 | Layers: routes → controllers → services → db; `app.js` separate from `server.js`; entry `backend/server.js` | Testable without HTTP; reviewers know where to look; keeps the merged Dockerfile unchanged | More files than a single-file app |
| ADR-008 | Config from `DATABASE_URL` and `PORT` (not `DB_HOST`/`API_PORT`) | These are what Compose and `.env.example` on `main` provide. (Supersedes the backend draft v0.1.) | One URL to change between Docker and local |
| ADR-009 | Integration tests run against a real Postgres built from `database/init.sql` | Catches schema/API drift. This approach found the `23001` bug. | CI needs a Postgres service (09 §4) |
| ADR-010 | Frontend reaches the API via the **Vite dev proxy at `/api`**, and the API also enables CORS for `:3000`/`:5173` | There is no Nginx in Compose; this keeps same-origin calls as the frontend design intended | `API_PROXY_TARGET` env var in the frontend container |

---

## 3. Alignment register: what differed and what we chose

The sources compared were the mentor brief; `main` (DevOps PR #1); the `database` branch (Samuel, `22143c5`); `feature/frontend-setup` (Cecilia, `fdd5beb`); and Joseph's backend drafts (former `backend-system` branch, since replaced by `feature/backend-setup`).

| # | Topic | Source A | Source B | Resolution | Owner of follow-up | Status |
|---|-------|----------|----------|------------|--------------------|--------|
| A-01 | Low-stock comparison | Frontend design / API draft: `<` | DB `verify.sql` + README: `<=` | `<=` (D-01) | Cecilia | ✅ |
| A-02 | Product "active status" | Frontend design shows it | Schema removed `is_active` | Removed from the UI | Cecilia | ⏳ |
| A-03 | API port | Backend draft: 4000 | Compose/Dockerfile: 8000 | **8000** | n/a | ✅ |
| A-04 | DB config | Backend draft: `DB_HOST`… | Compose: `DATABASE_URL` | **`DATABASE_URL`** | n/a | ✅ |
| A-05 | Node / Postgres versions | Drafts: Node 24, PG 16; schema tested on PG 18 | Merged: Node 20, PG 15 | **Node 20, PG 15** (the schema uses nothing newer) | n/a | ✅ |
| A-06 | Frontend API env var | Compose: `REACT_APP_API_URL`; `.env.example`: `NEXT_PUBLIC_API_URL` | Frontend is Vite | **`VITE_API_URL`** + `API_PROXY_TARGET` | Nana Yaw (C1) | ⏳ 🔴 |
| A-07 | Same-origin `/api` | Frontend design: "through the frontend proxy" | Compose: no Nginx, Vite dev server on 3000 | Vite `server.proxy` (ADR-010) | Cecilia | ⏳ |
| A-08 | Schema file path | Change request: `database/init/01_schema.sql` | DB branch: `database/init.sql` | `database/init.sql` (D-10) | n/a | ✅ |
| A-09 | Docs location | Backend: `backend/sys_docs`, `backend/docs` | Others: root `docs/` | Root **`dev_docs/`** for the agreed set; old drafts removed | Joseph | ✅ |
| A-10 | DB branch root README | `database` branch replaces the root README | `main` has the project README | Move it to `database/README.md` | Samuel | ⏳ |
| A-11 | FK delete error code | Backend draft: `23503` → `IN_USE` | Postgres with `ON DELETE RESTRICT` raises **`23001`** | Handle both (verified by test) | n/a | ✅ |
| A-12 | Seed revenue determinism | Seed assumes ids follow the `VALUES` order | Observed: ids reversed within category → revenue 12,044.00 instead of 12,549.50 | Add an ordinal + `ORDER BY` to the product insert; add a revenue assertion | Samuel | ⏳ 🔴 before CS-74 |
| A-13 | No low-stock rows in the seed | Brief wants a low-stock warning demo | Seed minimum stock 25 > 10 | Demo creates one live (08 §5), or raise some `reorder_level`s | Samuel / All | ⏳ |
| A-14 | `backend-system` branch behind `main` and cluttered with drafts | Missing `0a4606a`, `d1a8f5e` | n/a | Branch deleted (local + remote); `feature/backend-setup` created from latest `main` (`d1a8f5e`) | Joseph | ✅ |
| A-15 | CI scope | Brief: "runs checks on each PR" | CI only builds images | Add lint, test, DB-script and smoke jobs (09 §4) | Nana Yaw (C7) | ⏳ |
| A-16 | Sale "correct/cancel by authorized staff" | Frontend design | No auth in v1 | Anyone can, with a confirm dialog; roles are stretch | n/a | ✅ |
| A-17 | Endpoint list | Frontend design: 13 endpoints | API contract | Identical; contract adds params and stretch endpoints | n/a | ✅ |

---

## 4. Open questions

| # | Question | For | Answer | Date |
|---|----------|-----|--------|------|
| Q-01 | Is local Docker Compose enough for "deployed", or is a cloud URL expected? | Mentor | | |
| Q-02 | Is the `.pbix` file enough, or must it be published to Power BI Service? | Mentor | | |
| Q-03 | GitHub Projects or Jira for the sprint board? | Mentor | | |
| Q-04 | Currency label GHS: confirm | Mentor | | |
| Q-05 | Accept losing cancelled-sale history in v1 (D-04)? | Team | Accepted in the alignment report; confirm at sprint review | |
| Q-06 | Should product names be unique per category instead of globally (D-06)? | Samuel | | |
