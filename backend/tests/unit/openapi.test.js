const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// The contract served at /api/docs must be the team's contract (dev_docs/02 Section 5),
// with an example Swagger UI can show for every request and response (issue #31).
// No app import here, so these run without a database like the other unit tests.

const backendCopy = path.resolve(__dirname, '..', '..', 'openapi.yaml');
const teamCopy = path.resolve(__dirname, '..', '..', '..', 'dev_docs', 'openapi.yaml');
const spec = YAML.parse(fs.readFileSync(backendCopy, 'utf8'));

const METHODS = ['get', 'post', 'put', 'delete'];

// Follows a $ref such as '#/components/schemas/Product'.
function resolve(node) {
  if (!node || !node.$ref) return node;
  return node.$ref
    .slice(2)
    .split('/')
    .reduce((current, key) => current[key], spec);
}

// True when the schema, or anything inside it, has an example Swagger UI can show.
function hasExample(node, seen = new Set()) {
  const schema = resolve(node);
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return false;
  seen.add(schema);
  if ('example' in schema) return true;
  const children = [...Object.values(schema.properties || {}), schema.items, ...(schema.allOf || [])];
  return children.some((child) => hasExample(child, seen));
}

describe('openapi.yaml', () => {
  it('is the same file as dev_docs/openapi.yaml', () => {
    const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

    expect(read(backendCopy)).toBe(read(teamCopy));
  });

  it('has an example for every request body and success response', () => {
    const missing = [];
    for (const [specPath, operations] of Object.entries(spec.paths)) {
      for (const method of METHODS.filter((name) => operations[name])) {
        const operation = operations[method];
        const label = `${method.toUpperCase()} ${specPath}`;
        const body = operation.requestBody?.content['application/json'];
        if (body && !body.example && !hasExample(body.schema)) missing.push(`${label} request`);

        const [code, response] = Object.entries(operation.responses).find(([status]) => status.startsWith('2'));
        const content = resolve(response).content?.['application/json'];
        if (code !== '204' && !content?.example && !hasExample(content?.schema)) {
          missing.push(`${label} ${code}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
