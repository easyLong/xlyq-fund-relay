ALTER TABLE executor_accounts
  ADD COLUMN password_encrypted TEXT NULL AFTER account_uid;
