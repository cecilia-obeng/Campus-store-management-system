const { badRequest } = require('../errors');

// Checks input against a zod schema and returns the cleaned value
// (trimmed, converted, defaults applied). On failure, throws a 400
// with one { field, message } entry per problem.
function parse(schema, input, message) {
  const result = schema.safeParse(input ?? {});
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  throw badRequest(message, details);
}

module.exports = { parse };
