// Turn database rows into the exact objects the API contract describes
// Fields are listed one by one, so a new column
// never reaches the API by accident.

// pg returns NUMERIC as a string ("75.00") to avoid losing precision.
function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

// Agreed rule D-01: at or below the reorder level counts as low.
function isLowStock(stockQuantity, reorderLevel) {
  return stockQuantity <= reorderLevel;
}

function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    product_count: row.product_count,
  };
}

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    category_name: row.category_name,
    price: toNumber(row.price),
    stock_quantity: row.stock_quantity,
    reorder_level: row.reorder_level,
    is_low_stock: isLowStock(row.stock_quantity, row.reorder_level),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}


function toSale(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    category_id: row.category_id,
    category_name: row.category_name,
    quantity: row.quantity,
    unit_price: toNumber(row.unit_price),
    total: toNumber(row.total),
    payment_method: row.payment_method,
    sale_date: row.sale_date,
    created_at: row.created_at,
  };
}



module.exports = {
  toNumber,
  isLowStock,
  toCategory,
  toProduct,
  toSale,
};
