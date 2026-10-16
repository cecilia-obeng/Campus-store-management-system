const { z } = require('zod');
const {
  MAX_INT,
  PAYMENT_METHODS,
  queryInt,
  requiredOr,
  pagination,
  quantity,
  paymentMethod,
  saleDate,
  queryDate,
  checkDateRange,
} = require('./common');

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

const SALE_SORT_OPTIONS = ['sale_date', '-sale_date', 'total', '-total'];

// GET /api/sales query string. Every value arrives as text.
const listSalesQuery = checkDateRange(
  z.object({
    from: queryDate('From date').optional(),
    to: queryDate('To date').optional(),
    product_id: queryInt('Product').optional(),
    category_id: queryInt('Category').optional(),
    payment_method: z
      .enum(PAYMENT_METHODS, {
        error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`,
      })
      .optional(),
    sort: z
      .enum(SALE_SORT_OPTIONS, {
        error: `Sort must be one of: ${SALE_SORT_OPTIONS.join(', ')}.`,
      })
      .default('-sale_date'),
    ...pagination,
  }),
);

// PUT /api/sales/:id body: a partial update. product_id and unit_price are
// listed only so that sending them gives a clear 400 instead of being ignored:
// z.never() accepts no value at all, and .optional() lets the key be absent.
const updateSaleBody = z
  .object(
    {
      quantity: quantity.optional(),
      payment_method: paymentMethod.optional(),
      sale_date: saleDate.optional(),
      product_id: z
        .never({ error: 'Product cannot be changed; cancel the sale and record a new one.' })
        .optional(),
      unit_price: z
        .never({ error: 'Unit price cannot be changed; it is copied when the sale is recorded.' })
        .optional(),
    },
    { error: 'Request body must be a JSON object.' },
  )
  .refine(
    (body) =>
      body.quantity !== undefined ||
      body.payment_method !== undefined ||
      body.sale_date !== undefined,
    {
      message: 'Send at least one of quantity, payment_method or sale_date.',
      when: (payload) => payload.issues.length === 0,
    },
  );

module.exports = {
  SALE_SORT_OPTIONS,
  createSaleBody,
  listSalesQuery,
  updateSaleBody,
};
