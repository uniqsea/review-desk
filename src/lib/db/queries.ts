import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { decisionLogs, importBatches, importDuplicateLogs, papers, users, type PaperStatus } from "./schema";
import { calculatePercentages } from "@/lib/screening/stats";

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function findDuplicatePaper(doi: string | null, normalizedTitle: string) {
  const db = getDb();
  if (doi) {
    const [byDoi] = await db
      .select({ id: papers.id, title: papers.title, firstAuthor: papers.firstAuthor, year: papers.year, doi: papers.doi, status: papers.status })
      .from(papers)
      .where(eq(papers.doi, doi))
      .limit(1);
    if (byDoi) return { paper: byDoi, matchReason: "doi" as const };
  }
  const all = await db
    .select({ id: papers.id, title: papers.title, firstAuthor: papers.firstAuthor, year: papers.year, doi: papers.doi, status: papers.status })
    .from(papers);
  const match = all.find((p) => normalizeTitle(p.title) === normalizedTitle);
  if (match) return { paper: match, matchReason: "title" as const };
  return null;
}

export async function listPapers(status: "all" | "processed" | PaperStatus, query: string) {
  const db = getDb();
  const search = query.trim();
  const conditions = [];
  const latestDecisionAt = sql<string>`coalesce(${decisionLogs.createdAt}, ${papers.updatedAt})`;

  if (status === "processed") {
    conditions.push(
      or(
        eq(papers.status, "included"),
        eq(papers.status, "excluded"),
        eq(papers.status, "uncertain")
      )
    );
  } else if (status !== "all") {
    conditions.push(eq(papers.status, status));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(papers.title, pattern),
        like(papers.authorsText, pattern),
        like(papers.venue, pattern),
        like(papers.abstract, pattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      id: papers.id,
      title: papers.title,
      firstAuthor: papers.firstAuthor,
      year: papers.year,
      venue: papers.venue,
      status: papers.status
    })
    .from(papers)
    .leftJoin(decisionLogs, eq(papers.latestDecisionId, decisionLogs.id))
    .where(whereClause)
    .orderBy(
      status === "processed"
        ? desc(latestDecisionAt)
        : sql`CASE ${papers.status} WHEN 'pending' THEN 0 WHEN 'included' THEN 1 ELSE 2 END`,
      desc(papers.updatedAt)
    );
}

export async function getPaperById(id: string) {
  const db = getDb();

  const [paper] = await db
    .select({
      id: papers.id,
      title: papers.title,
      authorsText: papers.authorsText,
      firstAuthor: papers.firstAuthor,
      year: papers.year,
      venue: papers.venue,
      abstract: papers.abstract,
      keywordsText: papers.keywordsText,
      doi: papers.doi,
      status: papers.status,
      latestDecisionId: papers.latestDecisionId,
      latestDecisionReason: decisionLogs.reason,
      latestDecisionTimestamp: decisionLogs.createdAt
    })
    .from(papers)
    .leftJoin(decisionLogs, eq(papers.latestDecisionId, decisionLogs.id))
    .where(eq(papers.id, id))
    .limit(1);

  return paper ?? null;
}

export async function getDecisionLogs(limit = 100) {
  const db = getDb();
  return db
    .select({
      id: decisionLogs.id,
      paperId: decisionLogs.paperId,
      title: papers.title,
      reason: decisionLogs.reason,
      createdAt: decisionLogs.createdAt,
      kind: decisionLogs.kind,
      fromStatus: decisionLogs.fromStatus,
      toStatus: decisionLogs.toStatus,
      isActive: decisionLogs.isActive,
      targetDecisionId: decisionLogs.targetDecisionId,
      userDisplayName: users.displayName
    })
    .from(decisionLogs)
    .innerJoin(papers, eq(decisionLogs.paperId, papers.id))
    .innerJoin(users, eq(decisionLogs.userId, users.id))
    .orderBy(desc(decisionLogs.createdAt))
    .limit(limit);
}

export async function getStats() {
  const db = getDb();
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      included: sql<number>`sum(case when ${papers.status} = 'included' then 1 else 0 end)`,
      excluded: sql<number>`sum(case when ${papers.status} = 'excluded' then 1 else 0 end)`,
      pending: sql<number>`sum(case when ${papers.status} = 'pending' then 1 else 0 end)`,
      uncertain: sql<number>`sum(case when ${papers.status} = 'uncertain' then 1 else 0 end)`
    })
    .from(papers);

  const total = counts?.total ?? 0;
  const included = counts?.included ?? 0;
  const excluded = counts?.excluded ?? 0;
  const pending = counts?.pending ?? 0;
  const uncertain = counts?.uncertain ?? 0;

  return {
    total,
    included,
    excluded,
    pending,
    uncertain,
    percentages: calculatePercentages(total, included, excluded, pending)
  };
}

export async function getNextPendingPaperId(currentPaperId?: string) {
  const db = getDb();
  const items = await db
    .select({ id: papers.id })
    .from(papers)
    .where(eq(papers.status, "pending"))
    .orderBy(desc(papers.updatedAt));

  if (items.length === 0) {
    return null;
  }

  if (!currentPaperId) {
    return items[0]?.id ?? null;
  }

  const nextItem = items.find((item) => item.id !== currentPaperId);
  return nextItem?.id ?? items[0]?.id ?? null;
}

export async function getLatestActiveDecision(paperId: string) {
  const db = getDb();
  const [decision] = await db
    .select()
    .from(decisionLogs)
    .where(and(eq(decisionLogs.paperId, paperId), eq(decisionLogs.kind, "decision"), eq(decisionLogs.isActive, true)))
    .orderBy(desc(decisionLogs.createdAt))
    .limit(1);
  return decision ?? null;
}

export async function getCurrentDecisionSnapshot() {
  const db = getDb();
  return db
    .select({
      id: papers.id,
      title: papers.title,
      authorsText: papers.authorsText,
      year: papers.year,
      venue: papers.venue,
      status: papers.status,
      reason: decisionLogs.reason,
      timestamp: decisionLogs.createdAt
    })
    .from(papers)
    .leftJoin(decisionLogs, eq(papers.latestDecisionId, decisionLogs.id))
    .orderBy(desc(papers.updatedAt));
}

export async function getIncludedBibEntries() {
  const db = getDb();
  return db
    .select({ rawBibtex: papers.rawBibtex })
    .from(papers)
    .where(eq(papers.status, "included"))
    .orderBy(desc(papers.updatedAt));
}

export async function getImportBatches(limit = 50) {
  const db = getDb();
  return db
    .select({
      id: importBatches.id,
      sourceType: importBatches.sourceType,
      filename: importBatches.filename,
      rawCount: importBatches.rawCount,
      parsedCount: importBatches.parsedCount,
      failedCount: importBatches.failedCount,
      duplicateCount: importBatches.duplicateCount,
      skippedCount: importBatches.skippedCount,
      createdAt: importBatches.createdAt
    })
    .from(importBatches)
    .orderBy(desc(importBatches.createdAt))
    .limit(limit);
}

export async function getImportDuplicateLogsForBatch(batchId: string) {
  const db = getDb();
  return db
    .select({
      id: importDuplicateLogs.id,
      newTitle: importDuplicateLogs.newTitle,
      newDoi: importDuplicateLogs.newDoi,
      matchReason: importDuplicateLogs.matchReason,
      action: importDuplicateLogs.action,
      existingPaperTitle: papers.title,
      existingPaperStatus: papers.status
    })
    .from(importDuplicateLogs)
    .leftJoin(papers, eq(importDuplicateLogs.existingPaperId, papers.id))
    .where(eq(importDuplicateLogs.batchId, batchId));
}
