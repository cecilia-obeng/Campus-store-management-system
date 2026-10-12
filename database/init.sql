CREATE TABLE categories (
	category_id BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	category_name varchar(100) NOT NULL UNIQUE,
	created_at TIMESTAMPTZ NOT NULL
		DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products(
	product_id BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	category_id BIGINT NOT NULL,
	product_name varchar(150) NOT NULL,
	unit_price numeric(12, 2) NOT NULL,
	stock_quantity INTEGER NOT NULL DEFAULT 0,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL
		DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL
		DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_product_category
		FOREIGN KEY (category_id)
		REFERENCES categories(category_id)
		ON DELETE RESTRICT,

	CONSTRAINT chk_product_price
		CHECK (unit_price >= 0),

	CONSTRAINT chk_product_stock
		CHECK (stock_quantity >= 0)
);

CREATE TABLE sales(
	sale_id BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	product_id BIGINT  NOT NULL,
	quantity INTEGER NOT NULL,
	unit_price_at_sale NUMERIC(12, 2) NOT NULL,
	sold_at TIMESTAMPTZ NOT NULL
		DEFAULT CURRENT_TIMESTAMP,
	payment_method VARCHAR(20) NOT NULL,
	status VARCHAR(12) NOT NULL
		DEFAULT 'Completed',
	created_at TIMESTAMPTZ NOT NULL
		DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_sale_product
		FOREIGN KEY (product_id)
		REFERENCES products(product_id)
		ON DELETE RESTRICT,

	CONSTRAINT chk_sale_quantity
		CHECK (quantity > 0),

	CONSTRAINT chk_sale_price
		CHECK (unit_price_at_sale >= 0),

	CONSTRAINT chk_payment_method 
		CHECK (payment_method IN 
				('cash', 'mobile_money', 'card')),
				
	CONSTRAINT chk_sale_status
		CHECK (status IN ('completed', 'cancelled'))
);

CREATE INDEX idx_products_category
    ON products(category_id);

CREATE INDEX idx_sales_product
    ON sales(product_id);

CREATE INDEX idx_sales_date
    ON sales(sold_at);