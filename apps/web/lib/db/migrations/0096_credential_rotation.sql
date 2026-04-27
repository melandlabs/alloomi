-- Credential Rotation and Audit Logging
-- Issue #1982: Credential Security Management Enhancement

-- Add new columns to platform_accounts table for key versioning and rotation tracking
ALTER TABLE "platform_accounts"
ADD COLUMN IF NOT EXISTS "last_rotated_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "rotation_count" integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "key_version" integer DEFAULT 1 NOT NULL;

-- Create credential_rotation_history table
-- Stores previous credentials during rotation for rollback capability
CREATE TABLE IF NOT EXISTS "credential_rotation_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "credentials_encrypted" text NOT NULL,
  "encryption_key_id" text,
  "rotated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "rotated_by" text,
  "reason" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for credential_rotation_history
CREATE INDEX IF NOT EXISTS "credential_rotation_history_account_idx"
  ON "credential_rotation_history" ("account_id", "rotated_at" DESC);
CREATE INDEX IF NOT EXISTS "credential_rotation_history_expires_idx"
  ON "credential_rotation_history" ("expires_at")
  WHERE "expires_at" IS NOT NULL;

-- Add foreign key constraint for credential_rotation_history
DO $$ BEGIN
  ALTER TABLE "credential_rotation_history" ADD CONSTRAINT "credential_rotation_history_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create credential_access_log table
-- Audit log for credential operations
CREATE TABLE IF NOT EXISTS "credential_access_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "metadata" jsonb,
  "success" boolean NOT NULL DEFAULT true,
  "error_message" text,
  CONSTRAINT "credential_access_log_action_check"
    CHECK ("action" IN ('read', 'update', 'rotate', 'delete'))
);

-- Create indexes for credential_access_log
CREATE INDEX IF NOT EXISTS "credential_access_log_account_idx"
  ON "credential_access_log" ("account_id", "accessed_at" DESC);
CREATE INDEX IF NOT EXISTS "credential_access_log_user_idx"
  ON "credential_access_log" ("user_id", "accessed_at" DESC);
CREATE INDEX IF NOT EXISTS "credential_access_log_action_idx"
  ON "credential_access_log" ("action", "accessed_at" DESC);

-- Add foreign key constraints for credential_access_log
DO $$ BEGIN
  ALTER TABLE "credential_access_log" ADD CONSTRAINT "credential_access_log_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

  ALTER TABLE "credential_access_log" ADD CONSTRAINT "credential_access_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
