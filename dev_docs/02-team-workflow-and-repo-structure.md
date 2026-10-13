# 02. Team Workflow and Repository Structure

| | |
|---|---|
| **Repository** | `github.com/cecilia-obeng/Campus-store-management-system` |
| **Default branch** | `main` (protected: no direct pushes) |
| **Status** | Agreed v1.0 |

---

## 1. Roles

| Member | Owns | Also supports |
|--------|------|---------------|
| **Cecilia** | Frontend: pages, forms, product cards, search and filter, API calls, loading and error states | KPI/summary UI |
| **Joseph** | Backend: API endpoints, validation, business logic (stock), summary endpoint | API documentation (this folder, `openapi.yaml`) |
| **Samuel** | Data: schema, seed, SQL analysis, Power BI, insights report | Checks that API totals match SQL |
| **Nana Yaw** | DevOps: Dockerfiles, Compose, CI, environment, README run instructions | Database setup in containers |
| **Everyone** | Shared README, final demo (22 Oct 2026) | Reviewing each other's PRs |

---

## 2. Target repository structure

The brief requires `/frontend`, `/backend`, `/database`, `/analytics` and `/devops`. This is the layout every branch should converge on:

```
Campus-store-management-system/
├── .github/
│   └── workflows/ci.yml          CI on every PR (Nana Yaw)
├── .env.example                  committed template; real .env is git-ignored
├── .gitignore
├── docker-compose.yml            db + backend + frontend (Nana Yaw)
├── README.md                     shared project README (everyone)
│
├── dev_docs/                     ← THIS FOLDER: team documentation (all)
│   └── openapi.yaml              machine-readable API spec
│
├── frontend/                     React + Vite app (Cecilia)
│   ├── Dockerfile
│   ├── package.json
│   └── src/ …
│
├── backend/                      Node.js + Express API (Joseph)
│   ├── Dockerfile                (Nana Yaw; Joseph reviews)
│   ├── package.json
│   ├── server.js                 entry point (kept at root: Dockerfile runs it)
│   ├── src/                      app, config, db, routes, controllers, services…
│   ├── tests/
│   └── campus-store.postman_collection.json
│
├── database/                     PostgreSQL scripts (Samuel)
│   ├── init.sql                  schema (runs 1st in the container)
│   ├── seed.sql                  200 sample sales (runs 2nd)
│   ├── verify.sql                read-only checks (runs 3rd)
│   └── README.md                 database notes (moved from the branch root)
│
├── analytics/                    (Samuel)
│   ├── sql/                      revenue_by_month.sql, kpi_summary.sql, …
│   ├── powerbi/                  campus-store.pbix, dashboard.png
│   ├── insights-report.md
│   └── reconciliation-note.md
│
└── devops/                       extra DevOps assets, e.g. nginx.conf, scripts (Nana Yaw)
```

> ⚠️ **Only scripts that should run at database creation go in `database/`.** Compose mounts the whole folder into `/docker-entrypoint-initdb.d`, and Postgres runs every `.sql` file there **in alphabetical order** the first time the volume is created. Analysis queries belong in `analytics/sql/`.

---

## 3. Structure alignment: what differed and what changes

The current branches are **not** consistent with each other. This is what we found and the agreed fix. No other branch is edited by this documentation; each owner applies their own fix in their own PR.

| # | Finding | Where | Fix | Owner |
|---|---------|-------|-----|-------|
| S1 | Backend docs lived in `backend/sys_docs/` and `backend/docs/`; other branches use a root `docs/` folder. | former `backend-system` | ✅ Done: team docs now live in root **`dev_docs/`**; old drafts removed. | Joseph |
| S2 | `backend-system` was behind `main` (missing `0a4606a`, `d1a8f5e`). | former `backend-system` | ✅ Done: branch deleted; **`feature/backend-setup`** created from the latest `main`, with the backend folder structure. | Joseph |
| S3 | The schema proposal said `database/init/01_schema.sql`; Samuel kept `database/init.sql`, `seed.sql`, `verify.sql`. | `database` | **Keep Samuel's paths.** They work with the existing Compose mount, and alphabetical order (init → seed → verify) is correct. | n/a (decided) |
| S4 | The `database` branch has a root `README.md` describing only the database. It will conflict with the project README. | `database` | Move it to `database/README.md` before merging. | Samuel |
| S5 | The `database` and `feature/frontend-setup` branches add root `docs/…` files. | both | Fine to keep as the owners' original documents. `dev_docs/` is the consolidated, agreed set; add a link to it from `docs/` if useful. | Samuel, Cecilia |
| S6 | Backend design placed code entry at `backend/src/server.js`; the merged Dockerfile runs `npm run dev` → `node --watch server.js` at `backend/` root. | `main` | **Keep `backend/server.js` as the entry point** (it just starts `src/app.js`), so the Dockerfile doesn't change. | Joseph |
| S7 | `main` has an empty `database/init.sql` placeholder. | `main` | Replaced when the `database` PR merges. | Samuel |

---

## 4. Git workflow

### 4.1 Branches
- Always branch from an up-to-date `main`: `git switch main && git pull && git switch -c <branch>`.
- Naming: `<type>/<area>-<short-description>`, e.g. `feature/backend-products-api`, `fix/frontend-sale-form-errors`, `docs/dev-docs`, `chore/ci-backend-tests`.
- Existing branches (`database`, `feature/frontend-setup`, `feature/backend-setup`) stay as they are. New work uses short-lived branches, one per story.
- Keep branches short-lived (1–2 days). Merge `main` into your branch daily.

### 4.2 Commits
[Conventional Commits](https://www.conventionalcommits.org/) style, small and often:

```
feat(backend): record a sale with stock decrement
fix(frontend): show insufficient-stock message on sale form
docs(dev_docs): add API reference for sales
test(backend): oversell returns 409 and keeps stock
chore(ci): run backend tests against postgres service
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`. Scope: `backend`, `frontend`, `database`, `analytics`, `devops`, `ci`, `dev_docs`.

### 4.3 Pull requests
- One story per PR, ideally under 400 changed lines.
- PR title: `[CS-24] Record a sale with stock update`.
- Description: what changed, how to test (curl or steps), screenshots for UI, linked issue (`Closes #12`).
- **At least one approving review from a teammate.** The author never merges without approval.
- CI must be green before merging.
- Use **Squash and merge** to keep `main` history readable.

### 4.4 Who reviews what

| PR touches | Reviewer |
|------------|----------|
| `backend/` | Nana Yaw or Cecilia (Cecilia for contract-visible changes) |
| `frontend/` | Joseph (API usage) or Nana Yaw |
| `database/`, `analytics/` | Joseph (column names, metric definitions) |
| `docker-compose.yml`, `.github/`, `devops/`, Dockerfiles | Joseph or Samuel |
| `dev_docs/04`, `dev_docs/05`, `openapi.yaml` | Every affected owner (see §5) |

### 4.5 Secrets
- Never commit `.env`. It is git-ignored; `.env.example` holds placeholders only.
- No passwords, tokens or connection strings in code, docs or screenshots.
- If a secret is committed by mistake, tell the team, rotate it, and remove it from history.

---

## 5. Changing an agreed contract

[04 Database schema](04-database-schema.md) and [05 API reference](05-api-reference.md) are **frozen**. To change either:

1. Open a PR titled `contract: <what changes>` that edits the document **and** `openapi.yaml` (for API changes).
2. In the description, list who is affected and what they must change.
3. It needs approval from **every affected owner**: API change → Cecilia + Samuel; schema change → Joseph + Samuel.
4. Record the change in [10 Decisions log](10-decisions-and-alignment-log.md).
5. Merge the contract PR **before** the code that depends on it.

---

## 6. Ceremonies

| When | What | Length |
|------|------|--------|
| Daily | Stand-up: done, next, blockers | 15 min |
| Sprint day 1 | Planning: pick stories, set sprint goal | 1 h |
| Sprint day 5 | Review (demo working software) and retrospective | 45 min |
| Thu 22 Oct | Final demo and presentation | 15 min |

The board is GitHub Projects (or Jira, if the mentor prefers). Columns: Backlog → To do → In progress → In review → Done. Take a board screenshot at the end of each sprint for the deliverables.

---

## 7. Definition of Done

A story is Done when:
- [ ] The code is merged to `main` through a reviewed PR with green CI
- [ ] Its acceptance criteria are met and demonstrated in Docker
- [ ] Business rules have automated tests (backend) or have been checked by hand (frontend)
- [ ] The docs are updated (API reference, README, or the affected document)
- [ ] There are no secrets, debug logs or commented-out code
- [ ] The issue is closed and the board card is in Done
