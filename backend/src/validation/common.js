const { z } = require('zod');

// Largest value a PostgreSQL INTEGER column can hold.
const MAX_INT = 2147483647;

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

// For every /:id route.
const idParam = z.object({
  id: queryInt('Id'),
});

// Spread into list-query schemas.
const pagination = {
  page: queryInt('Page').default(1),
  limit: queryInt('Limit', { max: 100 }).default(20),
};

module.exports = {
  MAX_INT,
  queryInt,
  idParam,
  pagination,
};
