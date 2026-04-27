ALTER TABLE "Insight" ADD COLUMN "pending_deletion_at" timestamp with time zone;
ALTER TABLE "Insight" ADD COLUMN "compacted_into_insight_id" uuid;
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_compacted_into_insight_id_Insight_id_fk"
  FOREIGN KEY ("compacted_into_insight_id") REFERENCES "public"."Insight"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "insight_bot_id_pending_deletion_idx" ON "Insight" ("botId", "pending_deletion_at");
CREATE INDEX "insight_compacted_into_idx" ON "Insight" ("compacted_into_insight_id");

CREATE TABLE "insight_compaction_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "compacted_insight_id" uuid NOT NULL,
  "source_insight_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_compaction_links" ADD CONSTRAINT "insight_compaction_links_user_id_User_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_compaction_links" ADD CONSTRAINT "insight_compaction_links_compacted_insight_id_Insight_id_fk"
  FOREIGN KEY ("compacted_insight_id") REFERENCES "public"."Insight"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_compaction_links" ADD CONSTRAINT "insight_compaction_links_source_insight_id_Insight_id_fk"
  FOREIGN KEY ("source_insight_id") REFERENCES "public"."Insight"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "insight_compaction_links_compacted_idx" ON "insight_compaction_links" ("compacted_insight_id");
CREATE INDEX "insight_compaction_links_source_idx" ON "insight_compaction_links" ("source_insight_id");
CREATE UNIQUE INDEX "insight_compaction_links_pair_idx" ON "insight_compaction_links" ("compacted_insight_id", "source_insight_id");