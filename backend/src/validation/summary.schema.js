const { z } = require('zod');
const { queryInt, queryDate, checkDateRange } = require('./common');

// GET /api/summary query string: an optional period, with the same date rules
// as GET /api/sales. Other keys are stripped, so they are ignored.
const summaryQuery = checkDateRange(
  z.object({
    from: queryDate('From date').optional(),
    to: queryDate('To date').optional(),
  }),
);

// GET /api/summary/daily query string (dev_docs/05 Section 9.2): 1 to 90 days, default 7.
const dailyQuery = z.object({
  days: queryInt('Days', { max: 90 }).default(7),
});

module.exports = { summaryQuery, dailyQuery };
