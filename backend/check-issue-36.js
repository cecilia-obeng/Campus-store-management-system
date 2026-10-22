// Reconciliation check for Issue #36 (CS-74: API = SQL = Power BI).
// Compares GET /api/summary with Samuel's own SQL on the same database, for
// all time and for one month, then writes a draft of
// analytics/reconciliation-note.md with the API and SQL columns filled in and
// the Power BI column left for you and Samuel to type in.
//
// Run it with the stack running, from the project root:
//   node backend/guide/backend-reconciliation/scripts/check-issue-36.js
// Read-only: it never writes to the API or the database. It records a
// fingerprint of the sales and products tables at the start and at the end,
// and fails if anything changed in between ("freeze writes", 08 Section 4).
//
// Samuel's SQL is read from analytics/sql/ in your working tree if it's
// there, otherwise from his branch (origin/feature/analytics) without
// checking it out. Run `git fetch origin` first.
//
// Optional settings (defaults shown):
//   API=http://localhost:8000/api  DB_CONTAINER=campus_store_db  DB_NAME=campus_store
//   DB_USER=store_admin  MONTH=<the last complete UTC month, e.g. 2026-09>
//   SQL_BRANCH=origin/feature/analytics
//   KPI_SQL=<file>  TOP5_SQL=<file>  (use another file instead of Samuel's)
//   OUT=backend/guide/backend-reconciliation/out/reconciliation-note-draft.md

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const API = process.env.API || 'http://localhost:8000/api';
const DB_CONTAINER = process.env.DB_CONTAINER || 'campus_store_db';
const DB_NAME = process.env.DB_NAME || 'campus_store';
const DB_USER = process.env.DB_USER || 'store_admin';
const SQL_BRANCH = process.env.SQL_BRANCH || 'origin/feature/analytics';
const OUT = path.resolve(
  ROOT,
  process.env.OUT || 'backend/guide/backend-reconciliation/out/reconciliation-note-draft.md',
);

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`PASS  ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed += 1;
  }
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// Samuel's file: an explicit path, else the working tree, else his branch.
function readSamuelSql(envName, repoPath) {
  if (process.env[envName]) {
    const file = path.resolve(process.env[envName]);
    return { sql: fs.readFileSync(file, 'utf8'), source: file };
  }
  const local = path.join(ROOT, repoPath);
  if (fs.existsSync(local)) {
    return { sql: fs.readFileSync(local, 'utf8'), source: `${repoPath} (working tree)` };
  }
  const sql = execFileSync('git', ['show', `${SQL_BRANCH}:${repoPath}`], { cwd: ROOT, encoding: 'utf8' });
  const blob = git('rev-parse', '--short', `${SQL_BRANCH}:${repoPath}`);
  return { sql, source: `${repoPath} on ${SQL_BRANCH} (blob ${blob})` };
}

// Runs SQL in the database container; returns rows as arrays of strings.
function psql(sql) {
  const out = execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-At', '-F', '|',
      '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).map((line) => line.split('|'));
}

async function getJson(urlPath) {
  const res = await fetch(API + urlPath);
  return { status: res.status, body: await res.json() };
}

// kpi_summary.sql has its period as two DATE literals; put ours in instead.
function kpiSqlFor(kpiSql, from, to) {
  const pattern = /DATE '\d{4}-\d{2}-\d{2}' AS date_from,(\s*)DATE '\d{4}-\d{2}-\d{2}' AS date_to/;
  if (!pattern.test(kpiSql)) {
    throw new Error(
      'kpi_summary.sql no longer has "DATE \'…\' AS date_from, DATE \'…\' AS date_to". ' +
        'Read the file and update kpiSqlFor() (module 04).',
    );
  }
  return kpiSql.replace(pattern, `DATE '${from}' AS date_from,$1DATE '${to}' AS date_to`);
}

// The top-5 query is "Finding 3" in insights_report.sql, written for all
// time. Its header says how to limit it to a period: add a WHERE on sale_date.
function top5SqlFor(insightsSql, from, to) {
  const match = insightsSql.match(/-- Finding 3[^\n]*\n([\s\S]*?;)/);
  if (!match) {
    throw new Error('insights_report.sql has no "-- Finding 3" query. Read the file (module 04).');
  }
  const where =
    `WHERE s.sale_date >= (DATE '${from}'::timestamp AT TIME ZONE 'UTC')\n` +
    `  AND s.sale_date <  ((DATE '${to}' + 1)::timestamp AT TIME ZONE 'UTC')\n`;
  return match[1].replace(/\bGROUP BY\b/, `${where}GROUP BY`);
}

// One line that changes if any sale or product is added, changed or deleted.
function fingerprint() {
  const [sales] = psql(
    'SELECT count(*), coalesce(max(id), 0), coalesce(sum(quantity), 0), ' +
      'coalesce(sum(quantity * unit_price), 0), coalesce(max(created_at)::text, \'-\') FROM sales;',
  );
  const [products] = psql(
    'SELECT count(*), coalesce(sum(stock_quantity), 0), coalesce(max(updated_at)::text, \'-\') FROM products;',
  );
  return `sales ${sales.join(' / ')} · products ${products.join(' / ')}`;
}

function volumeCreatedAt() {
  try {
    const mounts = JSON.parse(
      execFileSync('docker', ['inspect', '-f', '{{json .Mounts}}', DB_CONTAINER], { encoding: 'utf8' }),
    );
    const data = mounts.find((m) => m.Destination === '/var/lib/postgresql/data');
    const created = execFileSync('docker', ['volume', 'inspect', '-f', '{{.CreatedAt}}', data.Name], {
      encoding: 'utf8',
    }).trim();
    return `volume ${data.Name}, created ${created}`;
  } catch {
    return 'volume unknown';
  }
}

function lastCompleteMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`MONTH must look like 2026-09, got "${month}"`);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

const money = (n) => Number(n).toFixed(2);

async function comparePeriod(label, from, to, sources) {
  console.log(`\n== ${label} ==`);
  const query = from ? `?from=${from}&to=${to}` : '';
  const res = await getJson(`/summary${query}`);
  if (res.status !== 200) {
    check(`GET /api/summary${query} -> 200`, false, `got ${res.status}: ${JSON.stringify(res.body)}`);
    return null;
  }
  const api = res.body.data;

  // "All time" in SQL: Samuel's file always takes two dates, so take wide ones.
  const sqlFrom = from || '1900-01-01';
  const sqlTo = to || '2999-12-31';
  const [k] = psql(kpiSqlFor(sources.kpi.sql, sqlFrom, sqlTo));
  const sql = {
    total_revenue: Number(k[0]),
    total_orders: Number(k[1]),
    average_order_value: Number(k[2]),
    total_units_sold: Number(k[3]),
    low_stock_count: Number(k[4]),
    top_products: psql(top5SqlFor(sources.top5.sql, sqlFrom, sqlTo)).map((r) => ({
      product_name: r[0],
      revenue: Number(r[3]),
    })),
  };

  const rows = [
    ['Total revenue', money(api.total_revenue), money(sql.total_revenue)],
    ['Total orders', String(api.total_orders), String(sql.total_orders)],
    ['Average order value', money(api.average_order_value), money(sql.average_order_value)],
    ['Units sold', String(api.total_units_sold), String(sql.total_units_sold)],
    ['Low-stock count', String(api.low_stock_count), String(sql.low_stock_count)],
  ];
  for (const [name, a, s] of rows) {
    check(`${name.padEnd(20)} API ${a.padStart(9)}   SQL ${s.padStart(9)}`, a === s);
  }

  const apiTop = api.top_products.map((p) => `${p.product_name} ${money(p.revenue)}`);
  const sqlTop = sql.top_products.map((p) => `${p.product_name} ${money(p.revenue)}`);
  const sameTop = JSON.stringify(apiTop) === JSON.stringify(sqlTop);
  check(
    `Top 5 names, order and revenue (${apiTop.length} products)`,
    sameTop,
    sameTop ? '' : `API: ${apiTop.join(', ')}\n      SQL: ${sqlTop.join(', ')}`,
  );
  if (sameTop) apiTop.forEach((line, i) => console.log(`        ${i + 1}. ${line}`));

  const top5Cell = api.top_products.map((p, i) => `${i + 1}. ${p.product_name}`).join('<br>');
  const sqlTop5Cell = sameTop ? 'same' : sql.top_products.map((p, i) => `${i + 1}. ${p.product_name}`).join('<br>');
  const table = [
    '| Metric              | API | SQL | Power BI | Match |',
    '|---------------------|----:|----:|---------:|:-----:|',
    ...rows.map(([name, a, s]) => `| ${name} | ${a} | ${s} | ⟨fill in⟩ | ${a === s ? 'API = SQL ✅, Power BI ⟨?⟩' : '❌ API ≠ SQL'} |`),
    `| Top 5 (names/order)  | ${top5Cell} | ${sqlTop5Cell} | ⟨fill in⟩ | ${sameTop ? 'API = SQL ✅, Power BI ⟨?⟩' : '❌ API ≠ SQL'} |`,
  ].join('\n');
  return table;
}

async function main() {
  console.log(`Checking ${API} against database ${DB_NAME} in container ${DB_CONTAINER}`);
  const health = await getJson('/health').catch(() => ({ status: 'no answer' }));
  if (health.status !== 200) {
    console.log(`The API is not answering at ${API}/health (${health.status}). Start the stack first (module 01).`);
    process.exit(1);
  }

  let sources;
  try {
    sources = {
      kpi: readSamuelSql('KPI_SQL', 'analytics/sql/kpi_summary.sql'),
      top5: readSamuelSql('TOP5_SQL', 'analytics/sql/insights_report.sql'),
    };
  } catch (err) {
    console.log(`Cannot find Samuel's SQL. Run "git fetch origin" (module 01).\n${err.message}`);
    process.exit(1);
  }

  let dbNow;
  let before;
  try {
    [[dbNow]] = psql('SELECT now();');
    before = fingerprint();
  } catch (err) {
    console.log(`Cannot read the database through docker (DB_CONTAINER=${DB_CONTAINER}, DB_NAME=${DB_NAME}).`);
    console.log(err.message);
    process.exit(1);
  }

  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no') ? ' (with uncommitted changes)' : '';
  const checkedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const volume = volumeCreatedAt();
  const { from, to } = monthRange(process.env.MONTH || lastCompleteMonth());

  console.log('\n== The snapshot (08 Section 4, step 1) ==');
  console.log(`      Checked:   ${checkedAt} UTC`);
  console.log(`      Commit:    ${commit}${dirty}`);
  console.log(`      now():     ${dbNow}`);
  console.log(`      Database:  ${DB_CONTAINER}/${DB_NAME}, ${volume}`);
  console.log(`      KPI SQL:   ${sources.kpi.source}`);
  console.log(`      Top 5 SQL: ${sources.top5.source}, "Finding 3"`);
  console.log(`      Writes:    ${before}`);

  const allTime = await comparePeriod('All time', '', '', sources);
  const month = await comparePeriod(`One month: ${from} to ${to}`, from, to, sources);

  // Two mistakes from 08 Section 4, step 7 only show on some data. Say whether
  // this database can show them, so a PASS isn't read as more than it is.
  console.log('\n== What this data can and cannot catch (08 Section 4, step 7) ==');
  const [[atLevel]] = psql('SELECT count(*) FROM products WHERE stock_quantity = reorder_level;');
  const [[repriced]] = psql(
    'SELECT count(*) FROM sales s JOIN products p ON p.id = s.product_id WHERE s.unit_price <> p.price;',
  );
  console.log(`      ${atLevel} product(s) with stock exactly at the reorder level: ` +
    (atLevel === '0' ? '"<" instead of "<=" for low stock would NOT show here' : '"<" vs "<=" is tested'));
  console.log(`      ${repriced} sale(s) whose unit_price differs from today's product price: ` +
    (repriced === '0' ? 'using products.price instead of sales.unit_price would NOT show here' : 'that mistake is tested'));

  console.log('\n== Writes frozen during the check (08 Section 4, step 2) ==');
  const after = fingerprint();
  check('nobody added, changed or cancelled a sale or product meanwhile', after === before,
    `before: ${before}\n      after:  ${after}`);

  if (allTime && month) {
    const note = [
      '# Reconciliation note',
      '',
      `- Checked: ${checkedAt} UTC · Commit: \`${commit}\`${dirty} · Database: ⟨machine⟩, ${DB_CONTAINER}/${DB_NAME}, ${volume}`,
      `- \`SELECT now()\`: ${dbNow}`,
      '- By: Samuel (SQL, Power BI), Joseph (API)',
      `- SQL: \`analytics/sql/kpi_summary.sql\` for the five figures; "Finding 3" of \`analytics/sql/insights_report.sql\` for the top 5`,
      after === before
        ? '- Writes frozen from the first reading to the last (sales and products unchanged).'
        : '- ⚠️ WRITES HAPPENED DURING THE CHECK: freeze writes and run it again before using these figures.',
      '',
      'Period: all time',
      '',
      allTime,
      '',
      `Period: ${from} to ${to} (whole UTC days)`,
      '',
      month,
      '',
      'Differences found and fixes: ⟨none, or what differed, why, and the fix⟩',
      '',
      'Signed: ⟨Samuel⟩ · ⟨Joseph⟩',
      '',
    ].join('\n');
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, note);
    console.log(`\nDraft note written to ${path.relative(ROOT, OUT)}`);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
