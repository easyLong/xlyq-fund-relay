-- Idempotent business key for Excel task imports.
SET @task_key_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'task_key'
);
SET @task_key_sql = IF(
  @task_key_exists = 0,
  'ALTER TABLE tasks ADD COLUMN task_key VARCHAR(512) NULL AFTER title',
  'SELECT 1'
);
PREPARE task_key_stmt FROM @task_key_sql;
EXECUTE task_key_stmt;
DEALLOCATE PREPARE task_key_stmt;

SET @task_key_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'uk_tasks_business_key'
);
SET @task_key_index_sql = IF(
  @task_key_index_exists = 0,
  'ALTER TABLE tasks ADD UNIQUE KEY uk_tasks_business_key (task_key)',
  'SELECT 1'
);
PREPARE task_key_index_stmt FROM @task_key_index_sql;
EXECUTE task_key_index_stmt;
DEALLOCATE PREPARE task_key_index_stmt;
