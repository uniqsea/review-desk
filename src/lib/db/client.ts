import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const IMPORT_DIR = path.join(DATA_DIR, "imports");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const DB_PATH = path.join(DATA_DIR, "review.db");
const DEFAULT_USER_ID = "local-reviewer";
const LEGACY_PROJECT_ID = "legacy-project";
const LEGACY_PROJECT_NAME = "Legacy";

let database: InstanceType<typeof Database> | null = null;

function ensureDataDirectories() {
  for (const dir of [DATA_DIR, IMPORT_DIR, EXPORT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function initializeDatabase() {
  ensureDataDirectories();

  if (!database) {
    database = new Database(DB_PATH);
    database.pragma("journal_mode = WAL");
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'reviewer',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS papers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL DEFAULT '',
        bibtex_key TEXT,
        raw_bibtex TEXT NOT NULL,
        title TEXT NOT NULL,
        authors_text TEXT,
        first_author TEXT,
        year INTEGER,
        venue TEXT,
        abstract TEXT,
        keywords_text TEXT,
        doi TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        latest_decision_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        filename TEXT,
        raw_input TEXT NOT NULL,
        raw_count INTEGER NOT NULL,
        parsed_count INTEGER NOT NULL,
        failed_count INTEGER NOT NULL,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_duplicate_logs (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        existing_paper_id TEXT NOT NULL,
        new_title TEXT NOT NULL,
        new_doi TEXT,
        match_reason TEXT NOT NULL,
        action TEXT NOT NULL,
        force_paper_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS paper_imports (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        paper_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decision_logs (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        reason TEXT,
        target_decision_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS papers_status_idx ON papers(status);
      CREATE INDEX IF NOT EXISTS papers_year_idx ON papers(year);
      CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at);
      CREATE INDEX IF NOT EXISTS decision_logs_paper_created_idx ON decision_logs(paper_id, created_at);
      CREATE INDEX IF NOT EXISTS decision_logs_user_created_idx ON decision_logs(user_id, created_at);
    `);

    // Migrations for existing databases
    try { database.exec("ALTER TABLE import_batches ADD COLUMN duplicate_count INTEGER NOT NULL DEFAULT 0"); } catch {}
    try { database.exec("ALTER TABLE import_batches ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0"); } catch {}
    try { database.exec("ALTER TABLE papers ADD COLUMN project_id TEXT NOT NULL DEFAULT ''"); } catch {}
    try { database.exec("ALTER TABLE import_batches ADD COLUMN project_id TEXT NOT NULL DEFAULT ''"); } catch {}
    try { database.exec("CREATE INDEX IF NOT EXISTS papers_project_idx ON papers(project_id)"); } catch {}
    try { database.exec("CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at)"); } catch {}

    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT OR IGNORE INTO users (id, display_name, email, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(DEFAULT_USER_ID, "Local Reviewer", null, "reviewer", now, now);

    database
      .prepare(
        `INSERT OR IGNORE INTO projects (id, user_id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(LEGACY_PROJECT_ID, DEFAULT_USER_ID, LEGACY_PROJECT_NAME, "Migrated pre-project data", now, now);

    database
      .prepare(`UPDATE papers SET project_id = ? WHERE project_id IS NULL OR project_id = ''`)
      .run(LEGACY_PROJECT_ID);
    database
      .prepare(`UPDATE import_batches SET project_id = ? WHERE project_id IS NULL OR project_id = ''`)
      .run(LEGACY_PROJECT_ID);
  }

  return database;
}

export function getDb() {
  const sqlite = initializeDatabase();
  return drizzle(sqlite);
}

export function getSqlite() {
  return initializeDatabase();
}

export function getDefaultUserId() {
  return DEFAULT_USER_ID;
}

export function getLegacyProject() {
  return { id: LEGACY_PROJECT_ID, name: LEGACY_PROJECT_NAME };
}

export function getDataDirectories() {
  initializeDatabase();
  return { DATA_DIR, IMPORT_DIR, EXPORT_DIR, DB_PATH };
}
