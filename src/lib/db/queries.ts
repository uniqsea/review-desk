import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  decisionLogs,
  importBatches,
  importDuplicateLogs,
  papers,
  projects,
  users,
  type PaperStatus
} from "./schema";
import { calculatePercentages } from "@/lib/screening/stats";

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function getProjects() {
  const db = getDb();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      paperCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id}
      )`,
      pendingCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id} and p.status = 'pending'
      )`,
      includedCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id} and p.status = 'included'
      )`,
      excludedCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id} and p.status = 'excluded'
      )`,
      uncertainCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id} and p.status = 'uncertain'
      )`
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt), desc(projects.createdAt));
}

export async function getProjectById(projectId: string) {
  const db = getDb();
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return project ?? null;
}

export async function findDuplicatePaper(projectId: string, doi: string | null, normalizedTitle: string) {
  const db = getDb();
  if (doi) {
    const [byDoi] = await db
      .select({
        id: papers.id,
        title: papers.title,
        firstAuthor: papers.firstAuthor,
        year: papers.year,
        doi: papers.doi,
        status: papers.status
      })
      .from(papers)
      .where(and(eq(papers.projectId, projectId), eq(papers.doi, doi)))
      .limit(1);
    if (byDoi) return { paper: byDoi, matchReason: "doi" as const };
  }

  const all = await db
    .select({
      id: papers.id,
      title: papers.title,
      firstAuthor: papers.firstAuthor,
      year: papers.year,
      doi: papers.doi,
      status: papers.status
    })
    .from(papers)
    .where(eq(papers.projectId, projectId));

  const match = all.find((paper) => normalizeTitle(paper.title) === normalizedTitle);
  if (match) return { paper: match, matchReason: "title" as const };
  return null;
}

export async function listPapers(status: "all" | "processed" | PaperStatus, query: string, projectId: string) {
  const db = getDb();
  const search = query.trim();
  const conditions = [eq(papers.projectId, projectId)];
  const latestDecisionAt = sql<string>`coalesce(${decisionLogs.createdAt}, ${papers.updatedAt})`;

  if (status === "processed") {
    conditions.push(
      or(eq(papers.status, "included"), eq(papers.status, "excluded"), eq(papers.status, "uncertain"))!
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
      )!
    );
  }

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
    .where(and(...conditions))
    .orderBy(
      status === "processed"
        ? desc(latestDecisionAt)
        : sql`CASE ${papers.status} WHEN 'pending' THEN 0 WHEN 'included' THEN 1 ELSE 2 END`,
      desc(papers.updatedAt)
    );
}

export async function getPaperById(id: string, projectId?: string) {
  const db = getDb();
  const conditions = [eq(papers.id, id)];
  if (projectId) {
    conditions.push(eq(papers.projectId, projectId));
  }

  const [paper] = await db
    .select({
      id: papers.id,
      projectId: papers.projectId,
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
    .where(and(...conditions))
    .limit(1);

  return paper ?? null;
}

export async function getDecisionLogs(projectId: string, limit = 100) {
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
    .where(eq(papers.projectId, projectId))
    .orderBy(desc(decisionLogs.createdAt))
    .limit(limit);
}

export async function getStats(projectId: string) {
  const db = getDb();
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      included: sql<number>`sum(case when ${papers.status} = 'included' then 1 else 0 end)`,
      excluded: sql<number>`sum(case when ${papers.status} = 'excluded' then 1 else 0 end)`,
      pending: sql<number>`sum(case when ${papers.status} = 'pending' then 1 else 0 end)`,
      uncertain: sql<number>`sum(case when ${papers.status} = 'uncertain' then 1 else 0 end)`
    })
    .from(papers)
    .where(eq(papers.projectId, projectId));

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

export async function getNextPendingPaperId(projectId: string, currentPaperId?: string) {
  const db = getDb();
  const items = await db
    .select({ id: papers.id })
    .from(papers)
    .where(and(eq(papers.projectId, projectId), eq(papers.status, "pending")))
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

export async function getLatestActiveDecision(paperId: string, projectId?: string) {
  const db = getDb();
  const conditions = [
    eq(decisionLogs.paperId, paperId),
    eq(decisionLogs.kind, "decision"),
    eq(decisionLogs.isActive, true)
  ];

  const query = db.select().from(decisionLogs);

  if (projectId) {
    query.innerJoin(papers, eq(decisionLogs.paperId, papers.id));
    conditions.push(eq(papers.projectId, projectId));
  }

  const [decision] = await query.where(and(...conditions)).orderBy(desc(decisionLogs.createdAt)).limit(1);
  return decision ?? null;
}

export async function getCurrentDecisionSnapshot(projectId: string) {
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
    .where(eq(papers.projectId, projectId))
    .orderBy(desc(papers.updatedAt));
}

export async function getIncludedBibEntries(projectId: string) {
  const db = getDb();
  return db
    .select({ rawBibtex: papers.rawBibtex })
    .from(papers)
    .where(and(eq(papers.projectId, projectId), eq(papers.status, "included")))
    .orderBy(desc(papers.updatedAt));
}

export async function getImportBatches(projectId: string, limit = 50) {
  const db = getDb();
  return db
    .select({
      id: importBatches.id,
      projectId: importBatches.projectId,
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
    .where(eq(importBatches.projectId, projectId))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit);
}

export async function getImportDuplicateLogsForBatch(batchId: string, projectId?: string) {
  const db = getDb();
  const conditions = [eq(importDuplicateLogs.batchId, batchId)];
  const query = db
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
    .innerJoin(importBatches, eq(importDuplicateLogs.batchId, importBatches.id));

  if (projectId) {
    conditions.push(eq(importBatches.projectId, projectId));
  }

  return query.where(and(...conditions));
}
