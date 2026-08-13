-- Add password login fields for the four MVP accounts.
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
  ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'EXECUTOR' AFTER password_hash;
