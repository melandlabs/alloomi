-- Credential Rotation and Audit Logging (SQLite)
-- Issue #1982: Credential Security Management Enhancement

-- Add new columns to platform_accounts table for key versioning and rotation tracking
ALTER TABLE `platform_accounts`
ADD COLUMN `last_rotated_at` integer;

ALTER TABLE `platform_accounts`
ADD COLUMN `rotation_count` integer DEFAULT 0 NOT NULL;

ALTER TABLE `platform_accounts`
ADD COLUMN `key_version` integer DEFAULT 1 NOT NULL;

-- Create credential_rotation_history table
-- Stores previous credentials during rotation for rollback capability
CREATE TABLE IF NOT EXISTS `credential_rotation_history` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `credentials_encrypted` text NOT NULL,
  `encryption_key_id` text,
  `rotated_at` integer NOT NULL,
  `rotated_by` text,
  `reason` text,
  `expires_at` integer,
  `created_at` integer NOT NULL
);

-- Create indexes for credential_rotation_history
CREATE INDEX IF NOT EXISTS `credential_rotation_history_account_idx`
  ON `credential_rotation_history` (`account_id`, `rotated_at` DESC);

CREATE INDEX IF NOT EXISTS `credential_rotation_history_expires_idx`
  ON `credential_rotation_history` (`expires_at`)
  WHERE `expires_at` IS NOT NULL;

-- Create credential_access_log table
-- Audit log for credential operations
CREATE TABLE IF NOT EXISTS `credential_access_log` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `user_id` text NOT NULL,
  `action` text NOT NULL,
  `ip_address` varchar(45),
  `user_agent` text,
  `accessed_at` integer NOT NULL,
  `metadata` text,
  `success` integer NOT NULL DEFAULT 1,
  `error_message` text,
  CONSTRAINT `credential_access_log_action_check`
    CHECK (`action` IN ('read', 'update', 'rotate', 'delete'))
);

-- Create indexes for credential_access_log
CREATE INDEX IF NOT EXISTS `credential_access_log_account_idx`
  ON `credential_access_log` (`account_id`, `accessed_at` DESC);

CREATE INDEX IF NOT EXISTS `credential_access_log_user_idx`
  ON `credential_access_log` (`user_id`, `accessed_at` DESC);

CREATE INDEX IF NOT EXISTS `credential_access_log_action_idx`
  ON `credential_access_log` (`action`, `accessed_at` DESC);
