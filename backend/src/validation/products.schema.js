const { z } = require('zod');
const { MAX_INT, queryInt, pagination } = require('./common');

const SORT_OPTIONS = [
  'name',
  '-name',
  'price',
  '-price',
  'stock_quantity',
  '-stock_quantity',
  'created_at',
  '-created_at',
];

// GET /api/products query string. Every value arrives as text.
const listProductsQuery = z.object({
  search: z
    .string({ error: 'Search must be text.' })
    .trim()
    .min(1, 'Search must be 1 to 100 characters.')
    .max(100, 'Search must be 1 to 100 characters.')
    .optional(),
  category_id: queryInt('Category').optional(),
  low_stock: z
    .enum(['true', 'false'], { error: 'Low stock must be true or false.' })
    .transform((value) => value === 'true')
    .optional(),
  sort: z
    .enum(SORT_OPTIONS, { error: `Sort must be one of: ${SORT_OPTIONS.join(', ')}.` })
    .default('name'),
  ...pagination,
});

// Picks the message for a missing field vs. a field of the wrong type.
function requiredOr(requiredMessage, typeMessage) {
  return (issue) => (issue.input === undefined ? requiredMessage : typeMessage);
}

// True if the number has at most 2 digits after the decimal point.
// Uses the number's text form, because float maths (4.35 * 100) is inexact.
function hasAtMostTwoDecimals(value) {
  return /^-?\d+(\.\d{1,2})?$/.test(String(value));
}

const STOCK_MESSAGE = 'Stock quantity must be a whole number, 0 or more.';
const REORDER_MESSAGE = 'Reorder level must be a whole number, 0 or more.';

// POST and PUT /api/products body. Unknown fields are stripped.
const productBody = z.object(
  {
    name: z
      .string({ error: requiredOr('Name is required.', 'Name must be text.') })
      .trim()
      .min(2, 'Name must be 2 to 100 characters.')
      .max(100, 'Name must be 2 to 100 characters.'),
    category_id: z
      .number({ error: requiredOr('Category is required.', 'Category must be a number.') })
      .int('Category must be a whole number.')
      .min(1, 'Category must be a whole number.')
      .max(MAX_INT, 'Category must be a whole number.'),
    price: z
      .number({ error: requiredOr('Price is required.', 'Price must be a number.') })
      .min(0, 'Price must be 0 or more.')
      .max(99999999.99, 'Price must be 99,999,999.99 or less.')
      .refine(hasAtMostTwoDecimals, 'Price can have at most 2 decimal places.'),
    stock_quantity: z
      .number({ error: requiredOr('Stock quantity is required.', STOCK_MESSAGE) })
      .int(STOCK_MESSAGE)
      .min(0, STOCK_MESSAGE)
      .max(MAX_INT, STOCK_MESSAGE),
    reorder_level: z
      .number({ error: REORDER_MESSAGE })
      .int(REORDER_MESSAGE)
      .min(0, REORDER_MESSAGE)
      .max(MAX_INT, REORDER_MESSAGE)
      .default(10),
  },
  { error: 'Request body must be a JSON object.' },
);

module.exports = {
  SORT_OPTIONS,
  listProductsQuery,
  productBody,
};
