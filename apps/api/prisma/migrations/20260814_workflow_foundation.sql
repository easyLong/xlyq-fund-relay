-- Workflow foundation tables. These are idempotent because some environments
-- may already contain the tables from an earlier bootstrap.
CREATE TABLE IF NOT EXISTS task_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  reason VARCHAR(1000) NULL,
  operator_id BIGINT UNSIGNED NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'WEB',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_task_status_history_task_created_at (task_id, created_at),
  KEY idx_task_status_history_operator_created_at (operator_id, created_at),
  CONSTRAINT fk_task_status_history_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_task_status_history_operator FOREIGN KEY (operator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS claim_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  reason VARCHAR(1000) NULL,
  operator_id BIGINT UNSIGNED NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'WEB',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_claim_status_history_claim_created_at (claim_id, created_at),
  KEY idx_claim_status_history_task_created_at (task_id, created_at),
  CONSTRAINT fk_claim_status_history_claim FOREIGN KEY (claim_id) REFERENCES task_claims(id),
  CONSTRAINT fk_claim_status_history_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_claim_status_history_operator FOREIGN KEY (operator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  claim_id BIGINT UNSIGNED NOT NULL,
  submission_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  result VARCHAR(32) NOT NULL,
  reason VARCHAR(1000) NULL,
  reviewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_reviews_submission (submission_id),
  KEY idx_task_reviews_task_result (task_id, result),
  KEY idx_task_reviews_claim_created_at (claim_id, created_at),
  KEY idx_task_reviews_reviewer_created_at (reviewer_id, created_at),
  CONSTRAINT fk_task_reviews_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_task_reviews_claim FOREIGN KEY (claim_id) REFERENCES task_claims(id),
  CONSTRAINT fk_task_reviews_submission FOREIGN KEY (submission_id) REFERENCES task_submissions(id),
  CONSTRAINT fk_task_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  template_code VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'UNREAD',
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_notifications_event_recipient_template (event_id, recipient_id, template_code),
  KEY idx_notifications_recipient_read_created (recipient_id, read_at, created_at),
  KEY idx_notifications_status_created_at (status, created_at),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  role_code VARCHAR(32) NULL,
  action VARCHAR(64) NOT NULL,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_logs_aggregate_created (aggregate_type, aggregate_id, created_at),
  KEY idx_audit_logs_user_created (user_id, created_at),
  KEY idx_audit_logs_action_created (action, created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS domain_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id BIGINT UNSIGNED NOT NULL,
  payload JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_retry_at DATETIME(3) NULL,
  processed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_domain_events_status_retry (status, next_retry_at),
  KEY idx_domain_events_aggregate (aggregate_type, aggregate_id),
  KEY idx_domain_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
