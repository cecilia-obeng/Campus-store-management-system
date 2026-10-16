const { z } = require('zod');

// Largest value a PostgreSQL INTEGER column can hold.
const MAX_INT = 2147483647;

// Allowed values of sales.payment_method (CHECK constraint in init.sql).
const PAYMENT_METHODS = ['cash', 'mobile_money', 'card'];

// How far ahead of the server clock a sale_date may be (cashier clocks drift).
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// A whole number that arrives as text (query string or URL segment).
// The regex rejects "", "2.5" and "abc" before converting;
// z.coerce.number() would turn "" into 0.
function queryInt(label, { min = 1, max = MAX_INT } = {}) {
  const message = `${label} must be a whole number.`;
  return z
    .string({ error: message })
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, `${label} must be at least ${min}.`)
        .max(max, `${label} must be at most ${max}.`),
    );
}

// Picks the message for a missing field vs. a field of the wrong type.
function requiredOr(requiredMessage, typeMessage) {
  return (issue) => (issue.input === undefined ? requiredMessage : typeMessage);
}

// For every /:id route.
const idParam = z.object({
  id: queryInt('Id'),
});

// Spread into list-query schemas.
const pagination = {
  page: queryInt('Page').default(1),
  limit: queryInt('Limit', { max: 100 }).default(20),
};

const QUANTITY_MESSAGE = 'Quantity must be a whole number from 1 to 10,000.';

// Body fields shared by recording (CS-24) and correcting (CS-25) a sale.
const quantity = z
  .number({ error: requiredOr('Quantity is required.', QUANTITY_MESSAGE) })
  .int(QUANTITY_MESSAGE)
  .min(1, QUANTITY_MESSAGE)
  .max(10000, QUANTITY_MESSAGE);

const paymentMethod = z.enum(PAYMENT_METHODS, {
  error: requiredOr(
    'Payment method is required.',
    `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`,
  ),
});

// ISO 8601 with seconds and a zone ("2026-10-13T11:05:00Z"), not in the future.
const saleDate = z
  .iso.datetime({
    offset: true,
    error: 'Sale date must be a date-time with a time zone, e.g. 2026-10-13T11:05:00Z.',
  })
  .refine(
    (value) => new Date(value).getTime() <= Date.now() + FUTURE_TOLERANCE_MS,
    'Sale date cannot be in the future.',
  );

// A calendar date in a query string ("2026-10-13"). The regex checks the shape
// (abort: skip the next check if it fails); the round trip rejects dates that
// don't exist, like 2026-02-30.
function queryDate(label) {
  const message = `${label} must be a real date written as YYYY-MM-DD.`;
  return z
    .string({ error: message })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message, abort: true })
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, message);
}

// Adds "from may not be after to" to a query schema with optional from/to dates.
// YYYY-MM-DD strings sort like the dates they stand for, so <= on text is enough.
// `when`: only compare once both dates are valid, so one mistake gives one message.
function checkDateRange(schema) {
  return schema.refine(
    (query) => query.from === undefined || query.to === undefined || query.from <= query.to,
    {
      message: 'From date must be on or before the to date.',
      path: ['from'],
      when: (payload) => payload.issues.length === 0,
    },
  );
}


module.exports = {
  MAX_INT,
  PAYMENT_METHODS,
  queryInt,
  requiredOr,
  idParam,
  pagination,
  quantity,
  paymentMethod,
  saleDate,
  queryDate,
  checkDateRange,
};
