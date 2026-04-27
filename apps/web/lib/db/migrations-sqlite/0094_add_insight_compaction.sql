ALTER TABLE `Insight` ADD COLUMN `compacted_into_insight_id` text;
ALTER TABLE `Insight` ADD COLUMN `pending_deletion_at` integer;

CREATE TABLE `insight_compaction_links` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `compacted_insight_id` text NOT NULL,
  `source_insight_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`compacted_insight_id`) REFERENCES `Insight`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_insight_id`) REFERENCES `Insight`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `insight_compaction_links_user_idx` ON `insight_compaction_links` (`user_id`);
--> statement-breakpoint
CREATE INDEX `insight_compaction_links_compacted_idx` ON `insight_compaction_links` (`compacted_insight_id`);
--> statement-breakpoint
CREATE INDEX `insight_compaction_links_source_idx` ON `insight_compaction_links` (`source_insight_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `insight_compaction_links_compacted_source_idx` ON `insight_compaction_links` (`compacted_insight_id`,`source_insight_id`);
