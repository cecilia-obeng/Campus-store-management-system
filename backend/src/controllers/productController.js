const productService = require('../services/productService');
const { parse } = require('../validation/validate');
const { idParam } = require('../validation/common');
const { listProductsQuery, productBody } = require('../validation/products.schema');

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

async function create(req, res) {
  const input = parse(productBody, req.body, 'Request body is invalid.');
  const data = await productService.create(input);
  res.status(201).location(`/api/products/${data.id}`).json({ data });
}

async function update(req, res) {
  const { id } = parse(idParam, req.params, 'Product id is invalid.');
  const input = parse(productBody, req.body, 'Request body is invalid.');
  const data = await productService.update(id, input);
  res.json({ data });
}

async function remove(req, res) {
  const { id } = parse(idParam, req.params, 'Product id is invalid.');
  await productService.remove(id);
  res.status(204).end();
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
