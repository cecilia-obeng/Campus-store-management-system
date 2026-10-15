const saleService = require('../services/saleService');
const { parse } = require('../validation/validate');
const { createSaleBody } = require('../validation/sales.schema');

async function create(req, res) {
  const input = parse(createSaleBody, req.body, 'Request body is invalid.');
  const data = await saleService.record(input);
  res.status(201).location(`/api/sales/${data.id}`).json({ data });
}

module.exports = {
  create,
};
