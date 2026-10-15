const productService = require('../services/productService');
const { parse } = require('../validation/validate');
const { idParam } = require('../validation/common');
const { listProductsQuery } = require('../validation/products.schema');

// Controllers only translate between HTTP and the service. Anything thrown
// here or in the service reaches errorHandler automatically (Express 5).

async function list(req, res) {
  const filters = parse(listProductsQuery, req.query, 'Query parameters are invalid.');
  const result = await productService.list(filters);
  res.json(result);
}

async function get(req, res) {
  const { id } = parse(idParam, req.params, 'Product id is invalid.');
  const data = await productService.getById(id);
  res.json({ data });
}

module.exports = {
  list,
  get,
};
