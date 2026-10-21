const summaryService = require('../services/summaryService');
const { parse } = require('../validation/validate');
const { summaryQuery, dailyQuery } = require('../validation/summary.schema');

async function get(req, res) {
  const period = parse(summaryQuery, req.query, 'Query parameters are invalid.');
  const data = await summaryService.get(period);
  res.json({ data });
}

async function daily(req, res) {
  const { days } = parse(dailyQuery, req.query, 'Query parameters are invalid.');
  const data = await summaryService.daily({ days });
  res.json({ data });
}

module.exports = { get, daily };
