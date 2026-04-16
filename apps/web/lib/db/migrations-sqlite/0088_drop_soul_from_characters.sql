-- Drop soul column from characters table (removed from schema)
-- Using simple DROP COLUMN - will fail if column doesn't exist (idempotent after first run)
ALTER TABLE "characters" DROP COLUMN "soul";
