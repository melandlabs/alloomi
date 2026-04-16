-- Add notification_channels column to characters table for notification channel configuration
ALTER TABLE "characters" ADD COLUMN "notification_channels" jsonb NOT NULL DEFAULT '[]';
