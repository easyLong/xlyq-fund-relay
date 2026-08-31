SET @post_key_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'fund_task_posts' AND column_name = 'post_key'
);
SET @post_key_sql = IF(
  @post_key_exists = 0,
  'ALTER TABLE fund_task_posts ADD COLUMN post_key VARCHAR(512) NULL AFTER platform',
  'SELECT 1'
);
PREPARE post_key_stmt FROM @post_key_sql;
EXECUTE post_key_stmt;
DEALLOCATE PREPARE post_key_stmt;

SET @post_key_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'fund_task_posts' AND index_name = 'uk_fund_task_posts_business_key'
);
SET @post_key_index_sql = IF(
  @post_key_index_exists = 0,
  'ALTER TABLE fund_task_posts ADD UNIQUE KEY uk_fund_task_posts_business_key (post_key)',
  'SELECT 1'
);
PREPARE post_key_index_stmt FROM @post_key_index_sql;
EXECUTE post_key_index_stmt;
DEALLOCATE PREPARE post_key_index_stmt;

SET @assigned_post_title_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'task_claims' AND column_name = 'assigned_post_title'
);
SET @assigned_post_title_sql = IF(
  @assigned_post_title_exists = 0,
  'ALTER TABLE task_claims ADD COLUMN assigned_post_title VARCHAR(255) NULL AFTER executor_account_id',
  'SELECT 1'
);
PREPARE assigned_post_title_stmt FROM @assigned_post_title_sql;
EXECUTE assigned_post_title_stmt;
DEALLOCATE PREPARE assigned_post_title_stmt;

SET @assigned_post_content_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'task_claims' AND column_name = 'assigned_post_content'
);
SET @assigned_post_content_sql = IF(
  @assigned_post_content_exists = 0,
  'ALTER TABLE task_claims ADD COLUMN assigned_post_content LONGTEXT NULL AFTER assigned_post_title',
  'SELECT 1'
);
PREPARE assigned_post_content_stmt FROM @assigned_post_content_sql;
EXECUTE assigned_post_content_stmt;
DEALLOCATE PREPARE assigned_post_content_stmt;

SET @assigned_post_url_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'task_claims' AND column_name = 'assigned_post_url'
);
SET @assigned_post_url_sql = IF(
  @assigned_post_url_exists = 0,
  'ALTER TABLE task_claims ADD COLUMN assigned_post_url VARCHAR(1024) NULL AFTER assigned_post_content',
  'SELECT 1'
);
PREPARE assigned_post_url_stmt FROM @assigned_post_url_sql;
EXECUTE assigned_post_url_stmt;
DEALLOCATE PREPARE assigned_post_url_stmt;
