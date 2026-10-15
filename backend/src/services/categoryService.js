const db = require('../db');
const { toCategory } = require('../mappers');

// Every category with how many products it has. LEFT JOIN keeps
// categories with no products; COUNT(p.id) then gives them 0.
async function list() {
  const { rows } = await db.query(`
    SELECT c.id, c.name, c.description, COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name, c.id
  `);
  return rows.map(toCategory);
}

module.exports = { list };
