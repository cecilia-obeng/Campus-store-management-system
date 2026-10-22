# Campus Store Sales Tracker — Sprint 2 insights report (CS-73)

**Status:** Analysis of a reproducible *sample dataset* generated from the supplied `database/init.sql` and `database/seed.sql`. This is not an analysis of production trading activity.  
**Reference seed time:** 15 October 2026, 20:32 UTC. The seed generates timestamps relative to `CURRENT_TIMESTAMP`; rerunning it on another day shifts the monthly grouping.  
**Reporting period for all sales metrics:** 1 August–15 October 2026 inclusive, by UTC sale date.  
**Currency:** Not specified in the seed; monetary figures intentionally do not use a currency symbol.  
**One order** means **one row of the `sales` table**, not necessarily an entire customer basket. A customer basket/order-header table does not exist in this schema.

**Figures:** The KPI table and category, payment, and monthly comparison tables below provide the numerical evidence. Run `analytics/sql/insights_report.sql` to generate the corresponding live query results.

## 1. Findings

### Finding 1 — The sample recorded 12,549.50 revenue across 200 sale rows

The 200 sales generated **402 units sold**, for an average of **62.75 per sale row** (`12,549.50 ÷ 200`, rounded to two decimals). Total current stock across the 24 products is **2,043 units**. These values match the seed's internal assertions. Revenue is calculated using *historical* `sales.unit_price` rather than the current product list price; each sale row is counted once.

| KPI | Sample result | Calculation |
|---|---:|---|
| Total revenue | 12,549.50 | Sum of `quantity × unit_price` |
| Total sale rows | 200 | Count of rows in period |
| Average sale-row value | 62.75 | Rounded total revenue ÷ 200 |
| Units sold | 402 | Sum of `quantity` |
| Low-stock products *now* | 2 | `stock_quantity <= reorder_level`, all dates |

### Finding 2 — Merchandise and electronics account for nearly three-quarters of revenue

Campus Merchandise generated **4,780.00 (38.09%)** and Electronics generated **4,495.00 (35.82%)**. Together they contributed **9,275.00, or 73.91%** of all sample revenue, despite representing just 67 of 200 sale rows. Higher unit prices help explain the revenue concentration; the sample alone cannot establish product-level profit margins.

| Category | Sale rows | Units | Revenue |
|---|---:|---:|---:|
| Campus Merchandise | 33 | 71 | 4,780.00 |
| Electronics | 34 | 71 | 4,495.00 |
| Personal Care | 34 | 64 | 1,016.00 |
| Snacks | 33 | 61 | 868.00 |
| Stationery | 33 | 65 | 702.50 |
| Beverages | 33 | 70 | 688.00 |

### Finding 3 — Three products produce 49.21% of sample revenue

The leading products by revenue were **Campus Hoodie (2,900.00)**, **Phone Wall Charger (1,700.00)** and **USB Flash Drive 32GB (1,575.00)**. Combined, they generated **6,175.00 (49.21%)** of revenue. Next came Campus T-Shirt (1,040.00) and Wired Earphones (765.00). Ranking uses revenue descending, then product name ascending when revenue ties; only products sold during the period qualify.

### Finding 4 — All three payment channels were used at similar frequencies

Sample sale-row counts were **cash 67**, **card 67**, and **mobile money 66**. Revenue by channel was **4,626.50 cash (36.87%)**, **4,118.00 card (32.81%)**, and **3,805.00 mobile money (30.32%)**. Differences in channel revenue do not prove customer preference because the 200 transactions and payment assignments were generated algorithmically.

| Reference month (UTC) | Sale rows | Revenue | Comparability |
|---|---:|---:|---|
| August 2026 | 21 | 1,508.50 | Partial month (seed starts in late August) |
| September 2026 | 120 | 7,216.50 | Full calendar month in the reference period |
| October 2026 | 59 | 3,824.50 | Partial month (through 15 October) |

**Caution:** Do not interpret the apparent monthly changes as growth or decline. The seed covers about 50 days and the first/last months have unequal exposure.

### Finding 5 — Two top-selling products have crossed their reorder thresholds

**Campus Hoodie** has **25 units remaining** against a **30-unit reorder level** and **Phone Wall Charger** has **30 units remaining** against a **35-unit reorder level**. Each sits five units below its reorder threshold. Both are also among the top three revenue products, making replenishment worth prioritising. The `low_stock_count` always uses the current `products` table and must *not* be restricted by the sales date range.

## 2. Recommendations

1. **Review and replenish the two flagged products first.** Confirm expected demand, lead times and available cash before choosing order quantities. A sensible initial minimum is to restore stock above each reorder threshold; **five units is the threshold shortfall, not an estimated optimal purchase order**. Maintain daily low-stock alerts.
2. **Prioritise availability and merchandising for merchandise and electronics.** These categories produce 73.91% of seeded revenue; track their item-level sell-through and margins once real transactional data and purchase costs are available. Do not infer profitability from sales revenue alone.
3. **Track payment and monthly patterns with real, comparable periods.** Retain cash, card and mobile-money reporting and compare *complete* months or use revenue per trading day. Replace the synthetic seed before making operational policy changes.

## 3. Metric consistency and safeguards

The metric definitions are documented in `dev_docs/05`, Section 7.2, and are used to keep the SQL, `GET /api/summary`, and Power BI results consistent. Sales periods start at `from` 00:00 UTC and end *before* (`to + 1 day`) 00:00 UTC. The API must return HTTP 400 for an invalid date or `from > to`. If no sales exist in the period, return revenue 0, order rows 0, average row value 0, and units 0. `low_stock_count` remains the current inventory count, regardless of the sales date filter.

The PostgreSQL schema (`database/init.sql`) defines three tables: `sales`, `products`, and `categories` (loaded into Power BI as `public sales`, `public products`, and `public categories`). Its foreign keys are `sales.product_id → products.id` and `products.category_id → categories.id`; these are the correct keys for relating the corresponding tables in Power BI. Sales timestamps are stored in `sales.sale_date` (`TIMESTAMPTZ`). Apply UTC reporting periods to `sales.sale_date`, count each `sales.id` once, and avoid duplicate sale rows when joining tables. The SQL files establish the database relationships; the saved `.pbix` model should be checked separately to confirm its relationships match.
### Reproducibility and limits

- Reference results were calculated independently from the deterministic loops in `database/seed.sql`; the original file itself checks **6 categories, 24 products, 200 sales, 402 units sold, 2,043 remaining units, and revenue 12,549.50**.
- These findings describe the reproducible seeded sample, not production trading data. The reference timestamp matters because `database/seed.sql` generates sale timestamps relative to `CURRENT_TIMESTAMP`; reseeding at another time can shift monthly totals.
- The Power BI deliverable is a `.pbix` report. The supplied Power BI screenshots show the same all-time KPI figures and top-five products as the checked seed/SQL results; they are evidence of what was displayed in the report, not a substitute for a new refresh after future data changes.
- Reviewers confirmed that both SQL files reproduce Findings 1–5 from a fresh seed, and that `analytics/sql/kpi_summary.sql` and the Finding 3 top five match `GET /api/summary` for both all time and September. Retain the same database snapshot and UTC date boundaries when repeating these checks. An empty-range API test and a check for one row per sale ID remain useful safeguards.

## 4. Reproducing and checking the findings

Run `analytics/sql/insights_report.sql` against the PostgreSQL database in the repository. The script contains six **SELECT-only** result sets for the five findings, follows the §7.2 definitions, and uses current stock for replenishment alerts. It defaults to **all sales in the database**, matching the report figures only for the unchanged original seed. If the data changes or is reseeded on another day, rerun the SQL and update the findings, including monthly dates. When analysing a selected period, apply the **same UTC inclusive start / exclusive next-day end** date filter to every sales-based query; never apply it to current stock.

**Issue #35 acceptance:** Five findings with numeric support and three recommendations are presented here. The reviewers have confirmed seed, SQL, API, and screenshot figure consistency; remaining PR review requirements and the project Definition of Done must still be satisfied before closing the issue.
