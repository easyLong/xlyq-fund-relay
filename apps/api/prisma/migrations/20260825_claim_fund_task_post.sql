ALTER TABLE task_claims ADD COLUMN fund_task_post_id BIGINT UNSIGNED NULL AFTER task_id;
ALTER TABLE task_claims ADD KEY idx_task_claims_fund_task_post (fund_task_post_id);
ALTER TABLE task_claims ADD CONSTRAINT fk_task_claims_fund_task_post FOREIGN KEY (fund_task_post_id) REFERENCES fund_task_posts (id);
ALTER TABLE task_claims ADD UNIQUE KEY uk_task_claims_post_active (fund_task_post_id, active_flag);
