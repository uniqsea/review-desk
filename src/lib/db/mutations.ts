import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { parseBibtex } from "@/lib/bibtex/parse";
import { normalizeBibtexEntry, type NormalizedPaperInput } from "@/lib/bibtex/normalize";
import { nowIso } from "@/lib/utils/time";
import { getDataDirectories, getDb, getSqlite } from "./client";
import {
  decisionLogs,
  importBatches,
  importDuplicateLogs,
  paperReviews,
  papers,
  projectMembers,
  projects,
  users,
  type PaperStatus
} from "./schema";
import {
  findDuplicatePaper,
  getLatestActiveDecision,
  getNextPendingPaperId,
  getPaperById,
  getProjectById,
  getProjectMembers,
  getReviewerStats,
  normalizeTitle
} from "./queries";
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

export async function createProject({
  userId,
  name,
  description
}: {
  userId: string;
  name: string;
  description?: string | null;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Project name is required");
  }

  const db = getDb();
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

  db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    userId,
    role: "owner",
    createdAt
  }).run();

  return {
    id: projectId,
    name: trimmedName,
    description: description?.trim() || null,
    createdAt,
    updatedAt: createdAt
  };
}

export async function renameProject({
  projectId,
  name
}: {
  projectId: string;
  name: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Project name is required");
  }

  const existingProject = await getProjectById(projectId);
  if (!existingProject) {
    throw new Error("Project not found");
  }

  const db = getDb();
  const updatedAt = nowIso();

  db.update(projects).set({ name: trimmedName, updatedAt }).where(eq(projects.id, projectId)).run();
  return { ...existingProject, name: trimmedName, updatedAt };
}

export async function addProjectMemberByUserId(projectId: string, userId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error("User not found");
  }

  const existingMembers = await getProjectMembers(projectId);
  if (existingMembers.some((member) => member.userId === user.id)) {
    throw new Error("User is already a project member");
  }

  const createdAt = nowIso();
  db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    userId: user.id,
    role: "reviewer",
    createdAt
  }).run();

  return user;
}

export async function removeProjectMember(projectId: string, userId: string) {
  const members = await getProjectMembers(projectId);
  const target = members.find((member) => member.userId === userId);
  if (!target) {
    throw new Error("Member not found");
  }
  if (target.role === "owner") {
    throw new Error("Owner cannot be removed");
  }

  const db = getDb();
  db.delete(projectMembers).where(eq(projectMembers.id, target.id)).run();
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

  for (const [token, cached] of previewCache.entries()) {
    if (cached.expiresAt < Date.now()) previewCache.delete(token);
  }

  return previewCache.get(batchToken)!.preview;
}

export async function commitImport({
  userId,
  batchToken,
  forceEntryIndices
}: {
  userId: string;
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
  const batchId = crypto.randomUUID();
  const createdAt = nowIso();
  let projectId = preview.projectId ?? null;

  const forceSet = new Set(forceEntryIndices);
  const duplicateIndexSet = new Set(preview.duplicates.map((d) => d.entryIndex));
  const entriesToInsert = validEntries.filter((_, i) => !duplicateIndexSet.has(i) || forceSet.has(i));
  const skippedDuplicates = preview.duplicates.filter((d) => !forceSet.has(d.entryIndex));
  const forcedDuplicates = preview.duplicates.filter((d) => forceSet.has(d.entryIndex));
  const insertedPaperIds = new Map<number, string>();

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
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId,
        userId,
        role: "owner",
        createdAt
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

    for (let i = 0; i < validEntries.length; i += 1) {
      if (duplicateIndexSet.has(i) && !forceSet.has(i)) continue;
      const entry = validEntries[i];
      const paperId = crypto.randomUUID();
      insertedPaperIds.set(i, paperId);
      db.insert(papers).values({
        id: paperId,
        projectId,
        importBatchId: batchId,
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
    }

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

    for (const dup of forcedDuplicates) {
      db.insert(importDuplicateLogs).values({
        id: crypto.randomUUID(),
        batchId,
        existingPaperId: dup.existingPaper.id,
        newTitle: dup.entry.title,
        newDoi: dup.entry.doi || null,
        matchReason: dup.matchReason,
        action: "force_imported",
        forcePaperId: insertedPaperIds.get(dup.entryIndex) ?? null,
        createdAt
      }).run();
    }
  })();

  if (preview.sourceType === "file" && preview.filename) {
    const { IMPORT_DIR } = getDataDirectories();
    fs.writeFileSync(path.join(IMPORT_DIR, `${batchId}-${preview.filename}`), preview.rawInput, "utf8");
  }

  logImport({
    label: preview.sourceType === "file" && preview.filename ? preview.filename : "pasted text",
    imported: entriesToInsert.length,
    skipped: skippedDuplicates.length,
    failed: preview.failures.length,
    duplicates: preview.duplicates.length
  });

  return {
    projectId,
    batchId,
    imported: entriesToInsert.length,
    skipped: skippedDuplicates.length,
    forceImported: forcedDuplicates.length,
    failed: preview.failures.length
  };
}

export async function importBibtexInput({
  userId,
  rawInput,
  sourceType,
  filename,
  mode,
  projectId,
  projectName
}: {
  userId: string;
  rawInput: string;
  sourceType: "file" | "text";
  filename?: string | null;
  mode: "new_project" | "existing_project";
  projectId?: string | null;
  projectName?: string | null;
}) {
  const preview = await previewImport({ rawInput, sourceType, filename, mode, projectId, projectName });
  return commitImport({ userId, batchToken: preview.batchToken, forceEntryIndices: [] });
}

export async function createDecision({
  paperId,
  reviewerId,
  decision,
  reason,
  projectId
}: {
  paperId: string;
  reviewerId: string;
  decision: Extract<PaperStatus, "included" | "excluded" | "uncertain">;
  reason?: string;
  projectId: string;
}) {
  const db = getDb();
  const sqlite = getSqlite();
  const createdAt = nowIso();
  const paper = await getPaperById(paperId, projectId, reviewerId);

  if (!paper) {
    throw new Error("Paper not found");
  }

  const [existingReview] = await db
    .select()
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, paperId), eq(paperReviews.reviewerId, reviewerId)))
    .limit(1);

  const fromStatus = (existingReview?.decision ?? "pending") as PaperStatus;
  const decisionId = crypto.randomUUID();

  sqlite.transaction(() => {
    if (existingReview) {
      db.update(paperReviews)
        .set({
          decision,
          reason: reason?.trim() || null,
          updatedAt: createdAt
        })
        .where(eq(paperReviews.id, existingReview.id))
        .run();
    } else {
      db.insert(paperReviews).values({
        id: crypto.randomUUID(),
        paperId,
        projectId,
        reviewerId,
        decision,
        reason: reason?.trim() || null,
        createdAt,
        updatedAt: createdAt
      }).run();
    }

    db.insert(decisionLogs).values({
      id: decisionId,
      paperId,
      userId: reviewerId,
      kind: "decision",
      fromStatus,
      toStatus: decision,
      reason: reason?.trim() || null,
      targetDecisionId: null,
      isActive: true,
      createdAt
    }).run();
  })();

  logDecision({ title: paper.title, fromStatus, toStatus: decision, reason: reason?.trim() });

  return {
    paper: await getPaperById(paperId, projectId, reviewerId),
    nextPendingPaperId: await getNextPendingPaperId(projectId, reviewerId, paperId),
    stats: await getReviewerStats(projectId, reviewerId)
  };
}

export async function undoLatestDecisionForPaper({
  paperId,
  reviewerId,
  projectId
}: {
  paperId: string;
  reviewerId: string;
  projectId: string;
}) {
  const decision = await getLatestActiveDecision(paperId, reviewerId);
  if (!decision) {
    throw new Error("No active decision to undo");
  }
  return undoDecisionById({ decisionId: decision.id, reviewerId, projectId });
}

export async function undoDecisionById({
  decisionId,
  reviewerId,
  projectId
}: {
  decisionId: string;
  reviewerId: string;
  projectId: string;
}) {
  const db = getDb();
  const sqlite = getSqlite();
  const createdAt = nowIso();
  const [targetDecision] = await db
    .select()
    .from(decisionLogs)
    .where(eq(decisionLogs.id, decisionId))
    .limit(1);

  if (!targetDecision || targetDecision.userId !== reviewerId) {
    throw new Error("Decision log not found");
  }
  if (targetDecision.kind !== "decision" || !targetDecision.isActive) {
    throw new Error("Decision log cannot be undone");
  }

  sqlite.transaction(() => {
    db.update(decisionLogs).set({ isActive: false }).where(eq(decisionLogs.id, decisionId)).run();

    db.insert(decisionLogs).values({
      id: crypto.randomUUID(),
      paperId: targetDecision.paperId,
      userId: reviewerId,
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
        `SELECT id, to_status, reason, created_at
         FROM decision_logs
         WHERE paper_id = ? AND user_id = ? AND kind = 'decision' AND is_active = 1
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(targetDecision.paperId, reviewerId) as
      | { id: string; to_status: PaperStatus; reason: string | null; created_at: string }
      | undefined;

    if (latestRemaining) {
      db.update(paperReviews)
        .set({
          decision: latestRemaining.to_status,
          reason: latestRemaining.reason,
          updatedAt: createdAt
        })
        .where(and(eq(paperReviews.paperId, targetDecision.paperId), eq(paperReviews.reviewerId, reviewerId)))
        .run();
    } else {
      db.delete(paperReviews)
        .where(and(eq(paperReviews.paperId, targetDecision.paperId), eq(paperReviews.reviewerId, reviewerId)))
        .run();
    }
  })();

  const undonePaper = await getPaperById(targetDecision.paperId, projectId, reviewerId);
  logUndo({ title: undonePaper?.title ?? "Paper", fromStatus: targetDecision.toStatus, toStatus: targetDecision.fromStatus });

  return {
    paper: undonePaper,
    stats: await getReviewerStats(projectId, reviewerId)
  };
}
