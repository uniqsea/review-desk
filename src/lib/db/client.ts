import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const IMPORT_DIR = path.join(DATA_DIR, "imports");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const DB_PATH = path.join(DATA_DIR, "review.db");

let database: InstanceType<typeof Database> | null = null;

function ensureDataDirectories() {
  for (const dir of [DATA_DIR, IMPORT_DIR, EXPORT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function ensureColumn(db: InstanceType<typeof Database>, table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
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
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'reviewer',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
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

      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS paper_reviews (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
    `);

    ensureColumn(database, "users", "password_hash", "password_hash TEXT");
    ensureColumn(database, "papers", "import_batch_id", "import_batch_id TEXT");

    database.exec(`
      CREATE INDEX IF NOT EXISTS sessions_user_expires_idx ON sessions(user_id, expires_at);
      CREATE INDEX IF NOT EXISTS papers_status_idx ON papers(status);
      CREATE INDEX IF NOT EXISTS papers_project_idx ON papers(project_id);
      CREATE INDEX IF NOT EXISTS papers_import_batch_idx ON papers(import_batch_id);
      CREATE INDEX IF NOT EXISTS papers_year_idx ON papers(year);
      CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at);
      CREATE INDEX IF NOT EXISTS project_members_project_user_idx ON project_members(project_id, user_id);
      CREATE INDEX IF NOT EXISTS project_members_user_project_idx ON project_members(user_id, project_id);
      CREATE INDEX IF NOT EXISTS paper_reviews_paper_reviewer_idx ON paper_reviews(paper_id, reviewer_id);
      CREATE INDEX IF NOT EXISTS paper_reviews_project_reviewer_idx ON paper_reviews(project_id, reviewer_id);
      CREATE INDEX IF NOT EXISTS paper_reviews_reviewer_updated_idx ON paper_reviews(reviewer_id, updated_at);
      CREATE INDEX IF NOT EXISTS decision_logs_paper_created_idx ON decision_logs(paper_id, created_at);
      CREATE INDEX IF NOT EXISTS decision_logs_user_created_idx ON decision_logs(user_id, created_at);
    `);

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

    const now = new Date().toISOString();

    database.exec(`
      INSERT INTO project_members (id, project_id, user_id, role, created_at)
      SELECT lower(hex(randomblob(16))), p.id, p.user_id, 'owner', '${now}'
      FROM projects p
      WHERE NOT EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = p.user_id
      )
    `);

    database.exec(`
      INSERT INTO paper_reviews (id, paper_id, project_id, reviewer_id, decision, reason, created_at, updated_at)
      SELECT
        lower(hex(randomblob(16))),
        p.id,
        p.project_id,
        prj.user_id,
        p.status,
        dl.reason,
        coalesce(dl.created_at, p.updated_at, p.created_at),
        coalesce(dl.created_at, p.updated_at, p.created_at)
      FROM papers p
      INNER JOIN projects prj ON prj.id = p.project_id
      LEFT JOIN decision_logs dl ON dl.id = p.latest_decision_id
      WHERE p.status IN ('included', 'excluded', 'uncertain')
        AND NOT EXISTS (
          SELECT 1
          FROM paper_reviews pr
          WHERE pr.paper_id = p.id AND pr.reviewer_id = prj.user_id
        )
    `);

    const missingUsers = database.prepare(`
      SELECT DISTINCT p.user_id as id
      FROM projects p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE u.id IS NULL
    `).all() as Array<{ id: string }>;

    const insertUser = database.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const user of missingUsers) {
      insertUser.run(user.id, "Legacy Owner", null, null, "reviewer", now, now);
    }

    const usersCount = (database.prepare(`SELECT count(*) as count FROM users`).get() as { count: number }).count;
    if (usersCount === 0) {
      const ownerId = randomUUID();
      const projectId = randomUUID();
      insertUser.run(ownerId, "Owner", null, null, "reviewer", now, now);
      database
        .prepare(
          `INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(projectId, ownerId, "Legacy", "Default project", now, now);
      database
        .prepare(
          `INSERT INTO project_members (id, project_id, user_id, role, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), projectId, ownerId, "owner", now);
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

export function getDataDirectories() {
  initializeDatabase();
  return { DATA_DIR, IMPORT_DIR, EXPORT_DIR, DB_PATH };
}
