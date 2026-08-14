-- Fund task master with N required post details.
CREATE TABLE fund_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fund_product_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  task_name VARCHAR(160) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_fund_tasks_product_task (fund_product_id, task_name),
  CONSTRAINT fk_fund_tasks_product FOREIGN KEY (fund_product_id) REFERENCES fund_products (id),
  CONSTRAINT fk_fund_tasks_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE fund_task_posts ADD COLUMN fund_task_id BIGINT UNSIGNED NULL AFTER fund_product_id;
ALTER TABLE fund_task_posts ADD KEY idx_fund_task_posts_task (fund_task_id);
ALTER TABLE fund_task_posts ADD CONSTRAINT fk_fund_task_posts_task FOREIGN KEY (fund_task_id) REFERENCES fund_tasks (id);

ALTER TABLE tasks ADD COLUMN fund_task_id BIGINT UNSIGNED NULL AFTER fund_task_post_id;
ALTER TABLE tasks ADD KEY idx_tasks_fund_task (fund_task_id);
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_fund_task FOREIGN KEY (fund_task_id) REFERENCES fund_tasks (id);

-- Preserve existing one-post records as one-post fund tasks.
INSERT INTO fund_tasks (fund_product_id, created_by, task_name, platform)
SELECT fund_product_id, created_by, task_name, platform
FROM fund_task_posts
WHERE fund_task_id IS NULL;

UPDATE fund_task_posts p
JOIN fund_tasks t ON t.fund_product_id = p.fund_product_id AND t.task_name = p.task_name AND t.platform = p.platform
SET p.fund_task_id = t.id
WHERE p.fund_task_id IS NULL;

UPDATE tasks t
JOIN fund_task_posts p ON p.id = t.fund_task_post_id
SET t.fund_task_id = p.fund_task_id
WHERE t.fund_task_id IS NULL;
