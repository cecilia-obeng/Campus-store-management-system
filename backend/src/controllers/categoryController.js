const categoryService = require('../services/categoryService');

async function list(req, res) {
  const data = await categoryService.list();
  res.json({ data });
}

module.exports = { list };
