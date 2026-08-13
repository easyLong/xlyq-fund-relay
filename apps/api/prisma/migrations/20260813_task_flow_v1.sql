-- Incremental migration for task claim/review/points MVP.
-- This file intentionally avoids Prisma db push because the shared database
-- already contains legacy tables that are not represented in the local MVP schema.

ALTER TABLE tasks
  ADD COLUMN reward_points INT UNSIGNED NOT NULL DEFAULT 10 AFTER approved_count;

ALTER TABLE task_claims
  ADD COLUMN reward_points INT UNSIGNED NULL AFTER version;

ALTER TABLE task_submissions
  ADD COLUMN review_comment TEXT NULL AFTER status,
  ADD COLUMN reviewed_at DATETIME(3) NULL AFTER review_comment,
  ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER reviewed_at;

CREATE TABLE user_point_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  available_points INT NOT NULL DEFAULT 0,
  frozen_points INT NOT NULL DEFAULT 0,
  withdrawn_points INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_point_accounts_user (user_id),
  CONSTRAINT fk_point_accounts_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE point_ledgers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  claim_id BIGINT UNSIGNED NULL,
  entry_type VARCHAR(32) NOT NULL,
  points INT NOT NULL,
  balance_after INT NOT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_point_ledgers_user_created_at (user_id, created_at),
  KEY idx_point_ledgers_task_type (task_id, entry_type),
  CONSTRAINT fk_point_ledgers_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_point_ledgers_task FOREIGN KEY (task_id) REFERENCES tasks (id),
  CONSTRAINT fk_point_ledgers_claim FOREIGN KEY (claim_id) REFERENCES task_claims (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
