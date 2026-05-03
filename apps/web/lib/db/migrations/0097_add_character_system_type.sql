-- Add system_type to identify per-user system characters such as Daily Focus.
ALTER TABLE "characters"
ADD COLUMN IF NOT EXISTS "system_type" varchar(50);

CREATE UNIQUE INDEX IF NOT EXISTS "characters_user_system_type_unique"
ON "characters" ("user_id", "system_type")
WHERE "system_type" IS NOT NULL;
