-- Add system_notification column to characters table for controlling local system notifications
ALTER TABLE characters ADD COLUMN system_notification INTEGER NOT NULL DEFAULT 1;
