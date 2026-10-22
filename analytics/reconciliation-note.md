# Reconciliation note — Issue #36 (CS-74)

**Purpose:** Compare the Campus Store summary API, Samuel's SQL calculations, and the Power BI dashboard for the same reporting periods and database snapshot.

- **Checked:** 2026-10-22 13:57:15 UTC (automated API/SQL check); Power BI checks observed later on 2026-10-22.
- **Git commit at scripted check:** `60d6049`.
- **Machine:** Campus Store project laptop (Windows; `C:\Users\HP\Desktop\Campus-store-management-system`).
- **Database used by automated check:** PostgreSQL 15, `campus_store_db` / `campus_store`, Docker volume `campus-store-management-system_postgres_data` (created 2026-10-22 13:52:22 UTC).
- **Data snapshot:** 200 sales, 402 units sold, 24 products, stock quantity sum 2,043; sales revenue 12,549.50.
- **SQL sources:** `analytics/sql/kpi_summary.sql` and "Finding 3" in `analytics/sql/insights_report.sql` (working tree).
- **Responsibilities:** Samuel — SQL / Power BI; Joseph — API.
- **Power BI source used for final comparison:** Docker PostgreSQL explicitly exposed as `localhost:5433`, database `campus_store`; API continued connecting to `db:5432` inside Docker. This was corrected from an ambiguous original `localhost` connection while local Windows PostgreSQL 18 was also running.

## Period: all time

| Metric | API | SQL | Power BI observed | Reconciliation |
|:--|--:|--:|--:|:--|
| Total revenue | 12,549.50 | 12,549.50 | 12.55K (rounded card) | Consistent to displayed precision; exact PBIX figure not independently exposed |
| Total orders | 200 | 200 | 200 | Match |
| Average order value | 62.75 | 62.75 | 62.75 | Match |
| Units sold | 402 | 402 | 402 | Match |
| Low-stock count | 2 | 2 | 2 | Match |
| Top 5 (names, rank, revenue) | See table below | Same as API | Same as API | Match |

| Rank | Product | API / SQL revenue | Power BI observed revenue |
|---:|:--|--:|--:|
| 1 | Campus Hoodie | 2,900.00 | 2,900 |
| 2 | Phone Wall Charger | 1,700.00 | 1,700 |
| 3 | USB Flash Drive 32GB | 1,575.00 | 1,575 |
| 4 | Campus T-Shirt | 1,040.00 | 1,040 |
| 5 | Wired Earphones | 765.00 | 765 |

## Period: 2026-09-01 to 2026-09-30 (whole UTC days)

The date range is **on or after September 1, 2026, 00:00**, **and before October 1, 2026, 00:00**.

| Metric | API | SQL | Power BI observed | Reconciliation |
|:--|--:|--:|--:|:--|
| Total revenue | 6,993.50 | 6,993.50 | 6.99K (rounded card / payment chart) | Consistent to displayed precision; exact PBIX figure not independently exposed |
| Total orders | 114 | 114 | 114 | Match |
| Average order value | 61.35 | 61.35 | 61.35 | Match |
| Units sold | 230 | 230 | 230 | Match |
| Low-stock count | 2 | 2 | 2 | Match |
| Top 5 (names, rank, revenue) | See table below | Same as API | Same as API | Match |

| Rank | Product | API / SQL revenue | Power BI observed revenue |
|---:|:--|--:|--:|
| 1 | Campus Hoodie | 1,450.00 | 1,450 |
| 2 | Phone Wall Charger | 1,020.00 | 1,020 |
| 3 | USB Flash Drive 32GB | 825.00 | 825 |
| 4 | Campus T-Shirt | 715.00 | 715 |
| 5 | Wired Earphones | 405.00 | 405 |

## Comparison script result

**13 passed, 0 failed** — API versus SQL comparisons for both reporting periods plus the no-write-during-check verification. Sales and products fingerprints were unchanged during the automated check. This does **not** independently verify all Power BI figures.

## Differences found and fixes

1. **Different Power BI data source discovered and corrected.** The original Power BI `localhost` connection yielded a September Wired Earphones value of 495.00 versus SQL/API 405.00, with sale ID 115 assigned to September 30 in Power BI versus October 1 in the Docker database. A separate Windows PostgreSQL 18 service was running alongside Docker PostgreSQL 15, so the original local source was ambiguous. Docker's host port was changed from 5432 to **5433** (container port remains 5432), Power BI was reconnected to `localhost:5433` as `store_admin`, and refreshed. Its Wired Earphones September revenue then became **405**, matching the API/SQL result. No sale rows were edited or deleted to force the comparison.
2. **Presentation precision:** Power BI revenue cards display abbreviated values (`12.55K` and `6.99K`). These agree with API/SQL after display rounding, but the exact unrounded Power BI total was not separately captured. Do not label these two Power BI totals as *exactly* verified until the complete numbers are displayed or queried from the measure.
3. **Limits of this check:** On this data no product has stock exactly at its reorder level, and no product's price has changed since it was sold, so the `<=` low-stock rule and the use of `sales.unit_price` could not show a difference here. Both are covered by the API tests (T-19, T-09) and are written that way in `analytics/sql/kpi_summary.sql` (as described in Joseph's reconciliation instructions; individual test results were not independently reviewed here).

## Power BI evidence

The all-time dashboard screenshots and the September-filtered screenshots were reviewed during reconciliation. For the PR evidence package, place four actual screenshots in `analytics/powerbi/` with these filenames:

- `analytics/powerbi/reconciliation_all_time.png`
- `analytics/powerbi/reconciliation_top5_all_time.png`
- `analytics/powerbi/reconciliation_month.png`
- `analytics/powerbi/reconciliation_top5_month.png`

These screenshot files still need to be saved to those repository paths; the paths above are the **required destinations**, not a claim that files already exist there.

## Conclusion and sign-off

**API = SQL**: confirmed for both periods by the script. **Power BI**: orders, units, AOV, low-stock count, and top-five product rankings and values agree with API/SQL; revenue totals agree at displayed precision. Exact full-precision Power BI revenue verification and attaching the four named screenshots remain before unconditional final sign-off.

**Prepared for review by:** Samuel (SQL and Power BI)

**Joseph (API):** signature / confirmation pending
