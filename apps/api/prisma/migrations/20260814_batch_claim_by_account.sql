-- Allow one executor user to claim the same task with multiple publishing accounts,
-- while keeping each publishing account unique for that task.
ALTER TABLE task_claims DROP INDEX uk_task_claims_active;
ALTER TABLE task_claims ADD UNIQUE KEY uk_task_claims_task_account_active (task_id, executor_account_id, active_flag);
