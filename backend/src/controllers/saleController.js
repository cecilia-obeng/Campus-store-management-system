const saleService = require('../services/saleService');
const { parse } = require('../validation/validate');
const { idParam } = require('../validation/common');
const { createSaleBody, listSalesQuery } = require('../validation/sales.schema');

async function list(req, res) {
  const filters = parse(listSalesQuery, req.query, 'Query parameters are invalid.');
  const result = await saleService.list(filters);
  res.json(result);
}

async function get(req, res) {
  const { id } = parse(idParam, req.params, 'Sale id is invalid.');
  const data = await saleService.getById(id);
  res.json({ data });
}

async function create(req, res) {
  const input = parse(createSaleBody, req.body, 'Request body is invalid.');
  const data = await saleService.record(input);
  res.status(201).location(`/api/sales/${data.id}`).json({ data });
}

module.exports = {
  list,
  get,
  create,
};
