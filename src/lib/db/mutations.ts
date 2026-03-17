import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { parseBibtex } from "@/lib/bibtex/parse";
import { normalizeBibtexEntry, type NormalizedPaperInput } from "@/lib/bibtex/normalize";
import { nowIso } from "@/lib/utils/time";
import { getDataDirectories, getDb, getDefaultUserId, getSqlite } from "./client";
import { decisionLogs, importBatches, importDuplicateLogs, paperImports, papers, projects, type PaperStatus } from "./schema";
import { findDuplicatePaper, getLatestActiveDecision, getNextPendingPaperId, getPaperById, getProjectById, getStats, normalizeTitle } from "./queries";
import { previewCache } from "./preview-cache";
import { logDecision, logImport, logUndo } from "@/lib/activity-log";

export interface DuplicateEntry {
  entryIndex: number;
  entry: NormalizedPaperInput;
  existingPaper: {
    id: string;
    title: string;
    firstAuthor: string | null;
    year: number | null;
    doi: string | null;
    status: string;
  };
  matchReason: "doi" | "title";
}

export interface ImportPreview {
  batchToken: string;
  mode: "new_project" | "existing_project";
  projectId?: string;
  projectName?: string;
  toImportCount: number;
  duplicates: DuplicateEntry[];
  failures: Array<{ raw: string; error: string }>;
  sourceType: "file" | "text";
  filename?: string | null;
  rawInput: string;
  rawCount: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createProject({
  name,
  description
}: {
  name: string;
  description?: string | null;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Project name is required");
  }

  const db = getDb();
  const userId = getDefaultUserId();
  const createdAt = nowIso();
  const projectId = crypto.randomUUID();

  db.insert(projects).values({
    id: projectId,
    userId,
    name: trimmedName,
    description: description?.trim() || null,
    createdAt,
    updatedAt: createdAt
  }).run();

  return {
    id: projectId,
    name: trimmedName,
    description: description?.trim() || null,
    createdAt,
    updatedAt: createdAt
  } satisfies ProjectSummary;
}

export async function previewImport({
  rawInput,
  sourceType,
  filename,
  mode,
  projectId,
  projectName
}: {
  rawInput: string;
  sourceType: "file" | "text";
  filename?: string | null;
  mode: "new_project" | "existing_project";
  projectId?: string | null;
  projectName?: string | null;
}): Promise<ImportPreview> {
  if (mode === "existing_project") {
    if (!projectId) {
      throw new Error("Project is required");
    }
    const project = await getProjectById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }
  }

  if (mode === "new_project" && !projectName?.trim()) {
    throw new Error("Project name is required");
  }

  const parsed = parseBibtex(rawInput);
  const failures = [...parsed.failures];
  const validEntries: NormalizedPaperInput[] = [];

  for (const entry of parsed.parsed) {
    const result = normalizeBibtexEntry(entry);
    if (!result.ok) {
      failures.push({ raw: entry.raw, error: result.error });
    } else {
      validEntries.push(result.value);
    }
  }

  const duplicates: DuplicateEntry[] = [];
  const toImportEntries: NormalizedPaperInput[] = [];

  for (let i = 0; i < validEntries.length; i += 1) {
    const entry = validEntries[i];
    if (mode === "existing_project" && projectId) {
      const doi = entry.doi || null;
      const normTitle = normalizeTitle(entry.title);
      const dup = await findDuplicatePaper(projectId, doi, normTitle);
      if (dup) {
        duplicates.push({ entryIndex: i, entry, existingPaper: dup.paper, matchReason: dup.matchReason });
        continue;
      }
    }
    toImportEntries.push(entry);
  }

  const batchToken = crypto.randomUUID();
  previewCache.set(batchToken, {
    preview: {
      batchToken,
      mode,
      projectId: projectId ?? undefined,
      projectName: projectName?.trim() || undefined,
      toImportCount: toImportEntries.length,
      duplicates,
      failures,
      sourceType,
      filename,
      rawInput,
      rawCount: parsed.rawEntries.length
    },
    validEntries,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  // Cleanup expired tokens
  for (const [token, cached] of previewCache.entries()) {
    if (cached.expiresAt < Date.now()) previewCache.delete(token);
  }

  return previewCache.get(batchToken)!.preview;
}

export async function commitImport({
  batchToken,
  forceEntryIndices
}: {
  batchToken: string;
  forceEntryIndices: number[];
}) {
  const cached = previewCache.get(batchToken);
  if (!cached || cached.expiresAt < Date.now()) {
    throw new Error("Preview session expired. Please re-import.");
  }
  previewCache.delete(batchToken);

  const { preview, validEntries } = cached;
  const db = getDb();
  const sqlite = getSqlite();
  const userId = getDefaultUserId();
  const batchId = crypto.randomUUID();
  const createdAt = nowIso();
  let projectId = preview.projectId ?? null;

  const forceSet = new Set(forceEntryIndices);
  const duplicateIndexSet = new Set(preview.duplicates.map((d) => d.entryIndex));

  // Entries to actually insert: non-duplicates + forced duplicates
  const entriesToInsert = validEntries.filter((_, i) => !duplicateIndexSet.has(i) || forceSet.has(i));
  const skippedDuplicates = preview.duplicates.filter((d) => !forceSet.has(d.entryIndex));
  const forcedDuplicates = preview.duplicates.filter((d) => forceSet.has(d.entryIndex));

  const insertedPaperIds = new Map<number, string>(); // entryIndex -> paperId

  sqlite.transaction(() => {
    if (preview.mode === "new_project") {
      projectId = crypto.randomUUID();
      db.insert(projects).values({
        id: projectId,
        userId,
        name: preview.projectName ?? "Untitled Project",
        description: null,
        createdAt,
        updatedAt: createdAt
      }).run();
    }

    if (!projectId) {
      throw new Error("Project not found");
    }

    db.insert(importBatches).values({
      id: batchId,
      projectId,
      userId,
      sourceType: preview.sourceType,
      filename: preview.filename ?? null,
      rawInput: preview.rawInput,
      rawCount: preview.rawCount,
      parsedCount: validEntries.length,
      failedCount: preview.failures.length,
      duplicateCount: preview.duplicates.length,
      skippedCount: skippedDuplicates.length,
      createdAt
    }).run();

    for (let i = 0; i < validEntries.length; i++) {
      if (duplicateIndexSet.has(i) && !forceSet.has(i)) continue;
      const entry = validEntries[i];
      const paperId = crypto.randomUUID();
      insertedPaperIds.set(i, paperId);
      db.insert(papers).values({
        id: paperId,
        projectId,
        bibtexKey: entry.bibtexKey,
        rawBibtex: entry.rawBibtex,
        title: entry.title,
        authorsText: entry.authorsText,
        firstAuthor: entry.firstAuthor,
        year: entry.year,
        venue: entry.venue,
        abstract: entry.abstract,
        keywordsText: entry.keywordsText,
        doi: entry.doi,
        status: "pending",
        latestDecisionId: null,
        createdAt,
        updatedAt: createdAt
      }).run();
      db.insert(paperImports).values({ id: crypto.randomUUID(), batchId, paperId }).run();
    }

    // Log skipped duplicates
    for (const dup of skippedDuplicates) {
      db.insert(importDuplicateLogs).values({
        id: crypto.randomUUID(),
        batchId,
        existingPaperId: dup.existingPaper.id,
        newTitle: dup.entry.title,
        newDoi: dup.entry.doi || null,
        matchReason: dup.matchReason,
        action: "skipped",
        forcePaperId: null,
        createdAt
      }).run();
    }

    // Log forced duplicates
    for (const dup of forcedDuplicates) {
      const forcePaperId = insertedPaperIds.get(dup.entryIndex) ?? null;
      db.insert(importDuplicateLogs).values({
        id: crypto.randomUUID(),
        batchId,
        existingPaperId: dup.existingPaper.id,
        newTitle: dup.entry.title,
        newDoi: dup.entry.doi || null,
        matchReason: dup.matchReason,
        action: "force_imported",
        forcePaperId,
        createdAt
      }).run();
    }
  })();

  if (preview.sourceType === "file" && preview.filename) {
    const { IMPORT_DIR } = getDataDirectories();
    fs.writeFileSync(path.join(IMPORT_DIR, `${batchId}-${preview.filename}`), preview.rawInput, "utf8");
  }

  const importedCount = entriesToInsert.length;
  const skippedCount = skippedDuplicates.length;
  const failedCount = preview.failures.length;
  const dupCount = preview.duplicates.length;
  const label = preview.sourceType === "file" && preview.filename ? preview.filename : "pasted text";
  logImport({ label, imported: importedCount, skipped: skippedCount, failed: failedCount, duplicates: dupCount });

  return {
    projectId,
    batchId,
    imported: importedCount,
    skipped: skippedCount,
    forceImported: forcedDuplicates.length,
    failed: failedCount
  };
}

export async function importBibtexInput({
  rawInput,
  sourceType,
  filename,
  mode,
  projectId,
  projectName
}: {
  rawInput: string;
  sourceType: "file" | "text";
  filename?: string | null;
  mode: "new_project" | "existing_project";
  projectId?: string | null;
  projectName?: string | null;
}) {
  const preview = await previewImport({
    rawInput,
    sourceType,
    filename,
    mode,
    projectId,
    projectName
  });

  return commitImport({
    batchToken: preview.batchToken,
    forceEntryIndices: []
  });
}

export async function createDecision({
  paperId,
  decision,
  reason,
  projectId
}: {
  paperId: string;
  decision: Extract<PaperStatus, "included" | "excluded" | "uncertain">;
  reason?: string;
  projectId?: string;
}) {
  const db = getDb();
  const sqlite = getSqlite();
  const userId = getDefaultUserId();
  const createdAt = nowIso();
  const paper = await getPaperById(paperId, projectId);

  if (!paper) {
    throw new Error("Paper not found");
  }

  const decisionId = crypto.randomUUID();

  sqlite.transaction(() => {
    db.insert(decisionLogs).values({
      id: decisionId,
      paperId,
      userId,
      kind: "decision",
      fromStatus: paper.status as PaperStatus,
      toStatus: decision,
      reason: reason?.trim() || null,
      targetDecisionId: null,
      isActive: true,
      createdAt
    }).run();

    db.update(papers)
      .set({
        status: decision,
        latestDecisionId: decisionId,
        updatedAt: createdAt
      })
      .where(eq(papers.id, paperId))
      .run();
  })();

  logDecision({ title: paper.title, fromStatus: paper.status, toStatus: decision, reason: reason?.trim() });

  return {
    paper: await getPaperById(paperId),
    nextPendingPaperId: await getNextPendingPaperId(paper.projectId, paperId),
    stats: await getStats(paper.projectId)
  };
}

export async function undoLatestDecisionForPaper(paperId: string, projectId?: string) {
  const decision = await getLatestActiveDecision(paperId, projectId);
  if (!decision) {
    throw new Error("No active decision to undo");
  }
  return undoDecisionById(decision.id);
}

export async function undoDecisionById(decisionId: string) {
  const db = getDb();
  const sqlite = getSqlite();
  const userId = getDefaultUserId();
  const createdAt = nowIso();
  const [targetDecision] = await db
    .select()
    .from(decisionLogs)
    .where(eq(decisionLogs.id, decisionId))
    .limit(1);

  if (!targetDecision) {
    throw new Error("Decision log not found");
  }

  if (targetDecision.kind !== "decision" || !targetDecision.isActive) {
    throw new Error("Decision log cannot be undone");
  }

  const [coveredUndo] = await db
    .select()
    .from(decisionLogs)
    .where(and(eq(decisionLogs.kind, "undo"), eq(decisionLogs.targetDecisionId, decisionId)))
    .limit(1);

  if (coveredUndo) {
    throw new Error("Decision already undone");
  }

  sqlite.transaction(() => {
    db.update(decisionLogs)
      .set({ isActive: false })
      .where(eq(decisionLogs.id, decisionId))
      .run();

    db.insert(decisionLogs).values({
      id: crypto.randomUUID(),
      paperId: targetDecision.paperId,
      userId,
      kind: "undo",
      fromStatus: targetDecision.toStatus,
      toStatus: targetDecision.fromStatus,
      reason: targetDecision.reason,
      targetDecisionId: decisionId,
      isActive: false,
      createdAt
    }).run();

    const latestRemaining = sqlite
      .prepare(
        `SELECT id, to_status FROM decision_logs
         WHERE paper_id = ? AND kind = 'decision' AND is_active = 1
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(targetDecision.paperId) as { id: string; to_status: PaperStatus } | undefined;

    db.update(papers)
      .set({
        status: latestRemaining?.to_status ?? "pending",
        latestDecisionId: latestRemaining?.id ?? null,
        updatedAt: createdAt
      })
      .where(eq(papers.id, targetDecision.paperId))
      .run();
  })();

  const undonePaper = await getPaperById(targetDecision.paperId);
  if (undonePaper) {
    logUndo({ title: undonePaper.title, fromStatus: targetDecision.toStatus, toStatus: targetDecision.fromStatus });
  }

  return {
    paper: undonePaper,
    stats: undonePaper ? await getStats(undonePaper.projectId) : null
  };
}
