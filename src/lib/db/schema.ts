import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("reviewer"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    userCreatedIdx: index("projects_user_created_idx").on(table.userId, table.createdAt)
  })
);

export const papers = sqliteTable(
  "papers",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    importBatchId: text("import_batch_id"),
    bibtexKey: text("bibtex_key"),
    rawBibtex: text("raw_bibtex").notNull(),
    title: text("title").notNull(),
    authorsText: text("authors_text"),
    firstAuthor: text("first_author"),
    year: integer("year"),
    venue: text("venue"),
    abstract: text("abstract"),
    keywordsText: text("keywords_text"),
    doi: text("doi"),
    status: text("status").notNull().default("pending"),
    latestDecisionId: text("latest_decision_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    projectIdx: index("papers_project_idx").on(table.projectId),
    importBatchIdx: index("papers_import_batch_idx").on(table.importBatchId),
    statusIdx: index("papers_status_idx").on(table.status),
    yearIdx: index("papers_year_idx").on(table.year)
  })
);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  sourceType: text("source_type").notNull(),
  filename: text("filename"),
  rawInput: text("raw_input").notNull(),
  rawCount: integer("raw_count").notNull(),
  parsedCount: integer("parsed_count").notNull(),
  failedCount: integer("failed_count").notNull(),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  createdAt: text("created_at").notNull()
});

export const importDuplicateLogs = sqliteTable("import_duplicate_logs", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull(),
  existingPaperId: text("existing_paper_id").notNull(),
  newTitle: text("new_title").notNull(),
  newDoi: text("new_doi"),
  matchReason: text("match_reason").notNull(),
  action: text("action").notNull(),
  forcePaperId: text("force_paper_id"),
  createdAt: text("created_at").notNull()
});

export const decisionLogs = sqliteTable(
  "decision_logs",
  {
    id: text("id").primaryKey(),
    paperId: text("paper_id").notNull(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    targetDecisionId: text("target_decision_id"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    paperCreatedIdx: index("decision_logs_paper_created_idx").on(table.paperId, table.createdAt),
    userCreatedIdx: index("decision_logs_user_created_idx").on(table.userId, table.createdAt)
  })
);

export type PaperStatus = "pending" | "included" | "excluded" | "uncertain";
export type DecisionKind = "decision" | "undo";
