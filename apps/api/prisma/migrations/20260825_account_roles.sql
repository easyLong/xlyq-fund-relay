-- Account role and fund-company scope configuration.
-- The organization is intentionally stored as a display name for simple account configuration.
CREATE TABLE IF NOT EXISTS account_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  role_code VARCHAR(32) NOT NULL,
  organization_name VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_account_roles_username_role (username, role_code),
  KEY idx_account_roles_username_status (username, status),
  KEY idx_account_roles_organization_status (organization_name, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO account_roles (username, role_code, organization_name, status)
VALUES
  ('admin', 'OPERATOR', NULL, 'ACTIVE'),
  ('staff1', 'EXECUTOR', NULL, 'ACTIVE'),
  ('staff2', 'EXECUTOR', NULL, 'ACTIVE'),
  ('staff3', 'EXECUTOR', NULL, 'ACTIVE'),
  ('fund1', 'FUND', '红土基金', 'ACTIVE'),
  ('fund2', 'FUND', '易方达基金', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  organization_name = VALUES(organization_name),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP(3);
