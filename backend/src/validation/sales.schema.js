const { z } = require('zod');
const { MAX_INT, requiredOr, quantity, paymentMethod, saleDate } = require('./common');

const PRODUCT_MESSAGE = 'Product must be a whole number.';

// POST /api/sales body. unit_price and total are not listed, so they are
// stripped: the server always copies the price from the product.
const createSaleBody = z.object(
  {
    product_id: z
      .number({ error: requiredOr('Product is required.', PRODUCT_MESSAGE) })
      .int(PRODUCT_MESSAGE)
      .min(1, PRODUCT_MESSAGE)
      .max(MAX_INT, PRODUCT_MESSAGE),
    quantity,
    payment_method: paymentMethod,
    sale_date: saleDate.optional(),
  },
  { error: 'Request body must be a JSON object.' },
);

module.exports = {
  createSaleBody,
};
