import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const IMPORT_DIR = path.join(DATA_DIR, "imports");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const DB_PATH = path.join(DATA_DIR, "review.db");
const DEFAULT_USER_ID = "b38e6f5d-4c9f-49f2-a7ec-7f6ecb6cb4eb";
const LEGACY_USER_ID = "local-reviewer";
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
        project_id TEXT NOT NULL,
        import_batch_id TEXT,
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
        project_id TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS papers_project_idx ON papers(project_id);
      CREATE INDEX IF NOT EXISTS papers_year_idx ON papers(year);
      CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at);
      CREATE INDEX IF NOT EXISTS decision_logs_paper_created_idx ON decision_logs(paper_id, created_at);
      CREATE INDEX IF NOT EXISTS decision_logs_user_created_idx ON decision_logs(user_id, created_at);
    `);

    const now = new Date().toISOString();
    const legacyUser = database
      .prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`)
      .get(LEGACY_USER_ID) as
        | {
            id: string;
            display_name: string;
            email: string | null;
            role: string;
            created_at: string;
            updated_at: string;
          }
        | undefined;

    const currentUser = database
      .prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`)
      .get(DEFAULT_USER_ID) as { id: string } | undefined;

    if (legacyUser && !currentUser) {
      database
        .prepare(
          `INSERT INTO users (id, display_name, email, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          DEFAULT_USER_ID,
          legacyUser.display_name,
          legacyUser.email,
          legacyUser.role,
          legacyUser.created_at,
          now
        );
      database
        .prepare(`UPDATE projects SET user_id = ? WHERE user_id = ?`)
        .run(DEFAULT_USER_ID, LEGACY_USER_ID);
      database
        .prepare(`UPDATE import_batches SET user_id = ? WHERE user_id = ?`)
        .run(DEFAULT_USER_ID, LEGACY_USER_ID);
      database
        .prepare(`UPDATE decision_logs SET user_id = ? WHERE user_id = ?`)
        .run(DEFAULT_USER_ID, LEGACY_USER_ID);
      database
        .prepare(`DELETE FROM users WHERE id = ?`)
        .run(LEGACY_USER_ID);
    }

    database
      .prepare(
        `INSERT OR IGNORE INTO users (id, display_name, email, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(DEFAULT_USER_ID, "Local Reviewer", null, "reviewer", now, now);

    const paperColumns = database.prepare(`PRAGMA table_info(papers)`).all() as Array<{ name: string }>;
    const hasImportBatchId = paperColumns.some((column) => column.name === "import_batch_id");
    if (!hasImportBatchId) {
      database.exec(`ALTER TABLE papers ADD COLUMN import_batch_id TEXT`);
      database.exec(`CREATE INDEX IF NOT EXISTS papers_import_batch_idx ON papers(import_batch_id)`);
    }

    const [paperImportsTable] = database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'paper_imports'`)
      .all() as Array<{ name: string }>;

    if (paperImportsTable) {
      database.exec(`
        UPDATE papers
        SET import_batch_id = (
          SELECT pi.batch_id
          FROM paper_imports pi
          WHERE pi.paper_id = papers.id
          LIMIT 1
        )
        WHERE import_batch_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM paper_imports pi
            WHERE pi.paper_id = papers.id
          )
      `);
      database.exec(`DROP TABLE paper_imports`);
    }

    const [anyProject] = database
      .prepare(`SELECT id FROM projects LIMIT 1`)
      .all() as Array<{ id: string }>;

    if (!anyProject) {
      const legacyProjectId = randomUUID();
      database
        .prepare(
          `INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(legacyProjectId, DEFAULT_USER_ID, LEGACY_PROJECT_NAME, "Default project", now, now);
    }
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

export function getDataDirectories() {
  initializeDatabase();
  return { DATA_DIR, IMPORT_DIR, EXPORT_DIR, DB_PATH };
}
