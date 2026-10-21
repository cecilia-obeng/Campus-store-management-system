const { z } = require('zod');
const { queryDate, checkDateRange } = require('./common');

// GET /api/summary query string: an optional period, with the same date rules
// as GET /api/sales. Other keys are stripped, so they are ignored.
const summaryQuery = checkDateRange(
  z.object({
    from: queryDate('From date').optional(),
    to: queryDate('To date').optional(),
  }),
);

module.exports = { summaryQuery };
