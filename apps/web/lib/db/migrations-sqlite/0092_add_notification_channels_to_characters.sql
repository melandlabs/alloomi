-- Add notification_channels column to characters table for notification channel configuration
ALTER TABLE "characters" ADD COLUMN "notification_channels" text NOT NULL DEFAULT '[]';
