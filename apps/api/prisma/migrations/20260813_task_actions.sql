-- Task lifecycle actions and reminder history.
CREATE TABLE task_reminders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NULL,
  message VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_task_reminders_task_created_at (task_id, created_at),
  KEY idx_task_reminders_recipient_created_at (recipient_id, created_at),
  CONSTRAINT fk_task_reminders_task FOREIGN KEY (task_id) REFERENCES tasks (id),
  CONSTRAINT fk_task_reminders_sender FOREIGN KEY (sender_id) REFERENCES users (id),
  CONSTRAINT fk_task_reminders_recipient FOREIGN KEY (recipient_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
