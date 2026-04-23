/**
 * SQLite Database Adapter
 * Used for Tauri local deployment
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as sqliteSchema from "../schema-sqlite";
import type { DrizzleDB } from "../types";

let db: DrizzleDB | null = null;

// Track registered process event listeners to prevent duplicate additions causing memory leaks
// Use global to maintain state after hot reload
declare global {
  var _sqliteRegisteredProcessListeners: {
    SIGUSR2?: boolean;
    exit?: boolean;
  };
}

if (!global._sqliteRegisteredProcessListeners) {
  global._sqliteRegisteredProcessListeners = {};
}

/**
 * Migration tracking table name
 */
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Automatically apply all pending migrations (synchronous)
 */
function applyPendingMigrations(sqlite: Database.Database): void {
  const migrationsFolder = join(process.cwd(), "lib/db/migrations-sqlite");

  if (!existsSync(migrationsFolder)) {
    console.warn(
      "⚠️  No migrations folder found. Please run: pnpm run db:generate:sqlite",
    );
    return;
  }

  // Create migration tracking table (if not exists)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Check if this is an old database (has tables but no migration records)
  const hasOldTables = sqlite
    .prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('User', 'Bot', 'Chat')",
    )
    .get() as { count: number };

  const appliedMigrationCount = sqlite
    .prepare(`SELECT COUNT(*) as count FROM ${MIGRATIONS_TABLE}`)
    .get() as { count: number };

  // If there are old tables but no migration records, it's an upgrade from an old version
  // Mark the first migration as applied only (since base tables already exist), let subsequent migrations continue to run
  if (hasOldTables.count > 0 && appliedMigrationCount.count === 0) {
    console.log("📦 Detected existing database from previous version");
    console.log("🔄 Marking initial migration as applied...");

    // Only mark the first migration (base tables)
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (migrationFiles.length > 0) {
      sqlite
        .prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`)
        .run(migrationFiles[0]);
      console.log(
        `✅ Marked ${migrationFiles[0]} as applied (existing tables)`,
      );
      console.log(
        `ℹ️  Will attempt to apply ${migrationFiles.length - 1} remaining migration(s)`,
      );
    }
    // Continue execution, let subsequent migrations attempt to run
  }

  // Get applied migrations
  const appliedMigrations = new Set(
    sqlite
      .prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`)
      .all()
      .map((row: any) => row.name),
  );

  // Get all migration files
  const migrationFiles = readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Apply pending migrations
  let appliedCount = 0;
  for (const file of migrationFiles) {
    if (!appliedMigrations.has(file)) {
      console.log(`🔄 Applying migration: ${file}`);

      try {
        const migrationSQL = readFileSync(
          join(migrationsFolder, file),
          "utf-8",
        );

        // Execute migration in transaction
        const applyMigration = sqlite.transaction(() => {
          sqlite.exec(migrationSQL);
          // Record applied migration
          sqlite
            .prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`)
            .run(file);
        });

        applyMigration();
        console.log(`  ✓ Applied migration: ${file}`);
        appliedCount++;
      } catch (error: any) {
        // If table already exists or column already exists error, may be migration order issue, try marking as applied
        if (
          error.code === "SQLITE_ERROR" &&
          (error.message.includes("already exists") ||
            error.message.includes("duplicate column name"))
        ) {
          console.warn(
            `  ⚠️  Migration changes already applied, marking as done: ${file}`,
          );
          sqlite
            .prepare(
              `INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
            )
            .run(file);
        } else {
          console.error(`  ❌ Failed to apply migration ${file}:`, error);
          throw error;
        }
      }
    }
  }

  if (appliedCount > 0) {
    console.log(`✅ Applied ${appliedCount} migration(s)`);
  } else {
    console.log("✅ All migrations are up to date");
  }
}

/**
 * Initialize SQLite database connection
 */
export function initSqliteDb(dbPath: string): DrizzleDB {
  if (db) {
    return db;
  }

  console.log(`🗄️  Initializing SQLite database at: ${dbPath}`);
  console.log(`   Process cwd: ${process.cwd()}`);

  // Ensure database directory exists
  const dbDir = dirname(dbPath);
  console.log(`   Database directory: ${dbDir}`);
  console.log(`   Directory exists: ${existsSync(dbDir)}`);

  if (!existsSync(dbDir)) {
    console.log(`   Creating directory: ${dbDir}`);
    mkdirSync(dbDir, { recursive: true });
  }

  try {
    // Create SQLite connection
    console.log(`   Opening database connection...`);
    const sqlite = new Database(dbPath);
    console.log(`   ✅ Database opened successfully`);

    // Enable WAL mode for better concurrent performance
    sqlite.pragma("journal_mode = WAL");

    // Set busy timeout to 30 seconds to handle concurrent access
    sqlite.pragma("busy_timeout = 30000");

    // Use FULL to maximize durability under sudden power loss.
    sqlite.pragma("synchronous = FULL");

    // Automatically apply all pending migrations
    console.log(`   Applying migrations...`);
    applyPendingMigrations(sqlite);
    console.log(`   ✅ Migrations applied`);

    // Create Drizzle instance and cast to DrizzleDB type (using SQLite schema)
    db = drizzle(sqlite, { schema: sqliteSchema }) as unknown as DrizzleDB;

    console.log(`✅ SQLite database initialized at: ${dbPath}`);
  } catch (error) {
    console.error(`❌ Failed to initialize SQLite database:`, error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack: ${error.stack}`);
    }
    throw error;
  }

  // Development environment: Add hot reload cleanup hook (register only once)
  if (process.env.NODE_ENV === "development") {
    // Next.js dev server sends SIGUSR2 signal on hot reload
    // Listen to this signal to close database connection, prevent memory leaks
    if (!global._sqliteRegisteredProcessListeners.SIGUSR2) {
      process.on("SIGUSR2", () => {
        console.log("🔄 Development reload detected, closing DB connection...");
        closeSqliteDb();
      });
      global._sqliteRegisteredProcessListeners.SIGUSR2 = true;
    }

    // Ensure cleanup on process exit (register only once)
    if (!global._sqliteRegisteredProcessListeners.exit) {
      process.on("exit", () => {
        closeSqliteDb();
      });
      global._sqliteRegisteredProcessListeners.exit = true;
    }
  }

  return db;
}

/**
 * Check and run database migrations (if needed)
 * This function should be called by external API, not automatically in initDb
 */
export async function ensureSqliteSchema(dbPath: string): Promise<boolean> {
  try {
    // Check if User table exists
    const sqlite = new Database(dbPath);
    const tableExists = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
      )
      .get();

    sqlite.close();

    if (tableExists) {
      console.log("✅ SQLite schema already exists");
      return true;
    }

    console.log("🔄 Initializing SQLite schema...");
    console.log("⚠️  Please run: pnpm run db:push");
    console.log("⚠️  Or call POST /api/db/init to initialize the database");

    return false;
  } catch (error) {
    console.error("❌ Failed to check SQLite schema:", error);
    return false;
  }
}

/**
 * Get database instance
 */
export function getSqliteDb(): DrizzleDB {
  if (!db) {
    throw new Error(
      "SQLite database not initialized. Call initSqliteDb first.",
    );
  }
  return db;
}

/**
 * Run database migrations (via Drizzle ORM)
 */
export async function runSqliteMigrations(
  dbPath: string,
  migrationsFolder: string,
) {
  const sqlite = new Database(dbPath);
  const drizzleDb = drizzle(sqlite, { schema: sqliteSchema });

  console.log("🔄 Running SQLite migrations...");

  await migrate(drizzleDb, { migrationsFolder });

  console.log("✅ SQLite migrations completed");

  sqlite.close();
}

/**
 * Close database connection
 */
export function closeSqliteDb() {
  if (db) {
    const sqlite = (db as any).$client as Database.Database;
    sqlite.close();
    db = null;
    console.log("🔒 SQLite database closed");
  }
}

/**
 * Check if database is initialized
 */
export function isSqliteDbInitialized(): boolean {
  return db !== null;
}
