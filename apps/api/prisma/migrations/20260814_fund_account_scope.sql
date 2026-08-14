ALTER TABLE users
  ADD COLUMN fund_product_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_users_fund_product (fund_product_id),
  ADD CONSTRAINT fk_users_fund_product
    FOREIGN KEY (fund_product_id) REFERENCES fund_products(id);
