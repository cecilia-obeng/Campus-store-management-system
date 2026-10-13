# Campus Store Sales Tracker: Team Documentation

The shared reference for all four developers: what we're building, how the system fits together, the contracts between frontend, backend and data, and how we work in sprints.

| | |
|---|---|
| **Project** | Campus Store Sales Tracker: web app, REST API, PostgreSQL, Power BI |
| **Team** | Cecilia (Frontend) · Joseph (Backend) · Samuel (Data) · Nana Yaw (DevOps) |
| **Mentor** | Ishaque Appiah |
| **Sprints** | Sprint 1: Fri 9 – Thu 15 Oct 2026 · Sprint 2: Fri 16 – Thu 22 Oct 2026 |
| **Final demo** | Thursday 22 October 2026 |
| **Version** | v1.0 (13 Oct 2026) |

---

## Documents

| # | Document | What it answers | Owner |
|---|----------|-----------------|-------|
| 01 | [Product requirements (PRD)](01-product-requirements.md) | What are we building, for whom, and what counts as done? | All |
| 02 | [Team workflow and repo structure](02-team-workflow-and-repo-structure.md) | Roles, folders, branches, PRs, Definition of Done | All |
| 03 | [System architecture](03-system-architecture.md) | How the containers and components fit together | Joseph + Nana Yaw |
| 04 | [Database schema](04-database-schema.md) | Tables, constraints, seed data (frozen contract) | Samuel |
| 05 | [API reference](05-api-reference.md) + [openapi.yaml](openapi.yaml) | Every endpoint, request, response and error (frozen contract) | Joseph |
| 06 | [Backend technical design](06-backend-technical-design.md) | How the API is structured and enforces the business rules | Joseph |
| 07 | [Sprint plan and backlog](07-sprint-plan-and-backlog.md) | Who does what, and when | All |
| 08 | [Testing and reconciliation](08-testing-and-reconciliation.md) | Acceptance tests; proving API = SQL = Power BI; demo script | All |
| 09 | [Environment and setup](09-environment-and-setup.md) | How to run it; env vars; CI | Nana Yaw |
| 10 | [Decisions and alignment log](10-decisions-and-alignment-log.md) | Why things are the way they are; open questions | Joseph |

**Read first:** 01 → 02 → 03, then the contract you consume (04 or 05).

---

## Source of truth

When documents disagree:
1. Merged code on `main` (Compose, Dockerfiles, `.env.example`, CI)
2. The database SQL (`database/init.sql`, `seed.sql`)
3. [05 API reference](05-api-reference.md)
4. The other documents here

04 and 05 are **frozen**. Change them only by a PR approved by every affected owner ([02 §5](02-team-workflow-and-repo-structure.md#5-changing-an-agreed-contract)).

---

## Open items blocking integration

| # | Item | Owner |
|---|------|-------|
| 1 | Frontend API env var must be `VITE_API_URL` (Compose and `.env.example` use other names) | Nana Yaw |
| 2 | Low-stock rule is `stock_quantity <= reorder_level`; the frontend design said `<`. Please confirm. | Cecilia |
| 3 | `database` branch: move its root `README.md` to `database/README.md` before merging | Samuel |
| 4 | Seed revenue isn't deterministic (product id order); fix before reconciliation | Samuel |
| 5 | CI only builds images; add lint, test and DB checks | Nana Yaw |

Details are in [10 §3](10-decisions-and-alignment-log.md#3-alignment-register-what-differed-and-what-we-chose).
