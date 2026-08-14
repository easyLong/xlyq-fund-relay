-- Executor-owned publishing accounts, fund post configuration, and task linkage.
CREATE TABLE executor_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  platform VARCHAR(64) NOT NULL,
  account_name VARCHAR(128) NOT NULL,
  account_uid VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_executor_accounts_user_status (user_id, status),
  CONSTRAINT fk_executor_accounts_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fund_task_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fund_product_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  task_name VARCHAR(160) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  post_title VARCHAR(255) NULL,
  post_content LONGTEXT NULL,
  post_url VARCHAR(1024) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_fund_task_posts_product_task (fund_product_id, task_name),
  CONSTRAINT fk_fund_task_posts_product FOREIGN KEY (fund_product_id) REFERENCES fund_products (id),
  CONSTRAINT fk_fund_task_posts_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tasks ADD COLUMN fund_task_post_id BIGINT UNSIGNED NULL AFTER fund_product_id;
ALTER TABLE tasks ADD KEY idx_tasks_fund_task_post (fund_task_post_id);
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_fund_task_post FOREIGN KEY (fund_task_post_id) REFERENCES fund_task_posts (id);

ALTER TABLE task_claims ADD COLUMN executor_account_id BIGINT UNSIGNED NULL AFTER user_id;
ALTER TABLE task_claims ADD KEY idx_task_claims_account_status (executor_account_id, status);
ALTER TABLE task_claims ADD CONSTRAINT fk_task_claims_executor_account FOREIGN KEY (executor_account_id) REFERENCES executor_accounts (id);
