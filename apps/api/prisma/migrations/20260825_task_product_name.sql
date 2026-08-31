-- Imported products are task attributes, not required master data.
SET @product_name_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'fund_product_name'
);
SET @product_name_sql = IF(
  @product_name_exists = 0,
  'ALTER TABLE tasks ADD COLUMN fund_product_name VARCHAR(128) NULL AFTER fund_product_id',
  'SELECT 1'
);
PREPARE product_name_stmt FROM @product_name_sql;
EXECUTE product_name_stmt;
DEALLOCATE PREPARE product_name_stmt;
