const summaryService = require('../services/summaryService');
const { parse } = require('../validation/validate');
const { summaryQuery } = require('../validation/summary.schema');

async function get(req, res) {
  const period = parse(summaryQuery, req.query, 'Query parameters are invalid.');
  const data = await summaryService.get(period);
  res.json({ data });
}

module.exports = { get };
