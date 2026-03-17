import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { calculatePercentages } from "@/lib/screening/stats";
import { getDb } from "./client";
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

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function getProjectsForUser(userId: string) {
  const db = getDb();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      role: projectMembers.role,
      paperCount: sql<number>`(
        select count(*) from papers p where p.project_id = ${projects.id}
      )`
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId))
    .orderBy(desc(projects.updatedAt), desc(projects.createdAt));
}

export async function getProjectById(projectId: string) {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return project ?? null;
}

export async function getProjectMembers(projectId: string) {
  const db = getDb();
  return db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      projectId: projectMembers.projectId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      displayName: users.displayName,
      email: users.email
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(projectMembers.role, users.displayName);
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return user ?? null;
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
        status: sql<string>`coalesce((select pr.decision from paper_reviews pr where pr.paper_id = ${papers.id} limit 1), 'pending')`
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
      status: sql<string>`coalesce((select pr.decision from paper_reviews pr where pr.paper_id = ${papers.id} limit 1), 'pending')`
    })
    .from(papers)
    .where(eq(papers.projectId, projectId));

  const match = all.find((paper) => normalizeTitle(paper.title) === normalizedTitle);
  if (match) return { paper: match, matchReason: "title" as const };
  return null;
}

export async function listReviewerPapers(
  status: "all" | "processed" | PaperStatus,
  query: string,
  projectId: string,
  reviewerId: string
) {
  const db = getDb();
  const search = query.trim();
  const allPapers = await db
    .select({
      id: papers.id,
      title: papers.title,
      firstAuthor: papers.firstAuthor,
      year: papers.year,
      venue: papers.venue,
      updatedAt: papers.updatedAt,
      reviewDecision: paperReviews.decision,
      reviewUpdatedAt: paperReviews.updatedAt
    })
    .from(papers)
    .leftJoin(
      paperReviews,
      and(eq(paperReviews.paperId, papers.id), eq(paperReviews.reviewerId, reviewerId))
    )
    .where(
      and(
        eq(papers.projectId, projectId),
        search
          ? or(
              like(papers.title, `%${search}%`),
              like(papers.authorsText, `%${search}%`),
              like(papers.venue, `%${search}%`),
              like(papers.abstract, `%${search}%`)
            )
          : undefined
      )
    );

  const rows = allPapers.map((paper) => ({
    id: paper.id,
    title: paper.title,
    firstAuthor: paper.firstAuthor,
    year: paper.year,
    venue: paper.venue,
    status: (paper.reviewDecision ?? "pending") as PaperStatus,
    sortAt: paper.reviewUpdatedAt ?? paper.updatedAt
  }));

  const filtered = rows.filter((row) => {
    if (status === "processed") return row.status !== "pending";
    if (status === "all") return true;
    return row.status === status;
  });

  filtered.sort((a, b) => {
    if (status === "processed") {
      return (b.sortAt ?? "").localeCompare(a.sortAt ?? "");
    }
    return (b.sortAt ?? "").localeCompare(a.sortAt ?? "");
  });

  return filtered.map(({ sortAt, ...row }) => row);
}

export async function getPaperById(id: string, projectId: string, reviewerId: string) {
  const db = getDb();
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
      status: paperReviews.decision,
      latestDecisionReason: paperReviews.reason,
      latestDecisionTimestamp: paperReviews.updatedAt
    })
    .from(papers)
    .leftJoin(
      paperReviews,
      and(eq(paperReviews.paperId, papers.id), eq(paperReviews.reviewerId, reviewerId))
    )
    .where(and(eq(papers.id, id), eq(papers.projectId, projectId)))
    .limit(1);

  if (!paper) return null;

  return {
    ...paper,
    status: (paper.status ?? "pending") as PaperStatus,
    latestDecisionId: null
  };
}

export async function getDecisionLogs(projectId: string, reviewerId?: string) {
  const db = getDb();
  const conditions = [eq(papers.projectId, projectId)];
  if (reviewerId) {
    conditions.push(eq(decisionLogs.userId, reviewerId));
  }

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
    .where(and(...conditions))
    .orderBy(desc(decisionLogs.createdAt))
    .limit(100);
}

export async function getReviewerStats(projectId: string, reviewerId: string) {
  const rows = await listReviewerPapers("all", "", projectId, reviewerId);
  const total = rows.length;
  const included = rows.filter((row) => row.status === "included").length;
  const excluded = rows.filter((row) => row.status === "excluded").length;
  const uncertain = rows.filter((row) => row.status === "uncertain").length;
  const pending = rows.filter((row) => row.status === "pending").length;

  return {
    total,
    included,
    excluded,
    pending,
    uncertain,
    percentages: calculatePercentages(total, included, excluded, pending)
  };
}

export async function getNextPendingPaperId(projectId: string, reviewerId: string, currentPaperId?: string) {
  const items = await listReviewerPapers("pending", "", projectId, reviewerId);
  if (items.length === 0) return null;
  if (!currentPaperId) return items[0]?.id ?? null;
  const nextItem = items.find((item) => item.id !== currentPaperId);
  return nextItem?.id ?? items[0]?.id ?? null;
}

export async function getLatestActiveDecision(paperId: string, reviewerId: string) {
  const db = getDb();
  const [decision] = await db
    .select()
    .from(decisionLogs)
    .where(
      and(
        eq(decisionLogs.paperId, paperId),
        eq(decisionLogs.userId, reviewerId),
        eq(decisionLogs.kind, "decision"),
        eq(decisionLogs.isActive, true)
      )
    )
    .orderBy(desc(decisionLogs.createdAt))
    .limit(1);

  return decision ?? null;
}

export async function getCurrentReviewerSnapshot(projectId: string, reviewerId: string) {
  const db = getDb();
  return db
    .select({
      id: papers.id,
      title: papers.title,
      authorsText: papers.authorsText,
      year: papers.year,
      venue: papers.venue,
      status: paperReviews.decision,
      reason: paperReviews.reason,
      timestamp: paperReviews.updatedAt
    })
    .from(papers)
    .leftJoin(
      paperReviews,
      and(eq(paperReviews.paperId, papers.id), eq(paperReviews.reviewerId, reviewerId))
    )
    .where(and(eq(papers.projectId, projectId), eq(paperReviews.reviewerId, reviewerId)))
    .orderBy(desc(paperReviews.updatedAt));
}

export async function getProjectSummary(projectId: string) {
  const db = getDb();
  const members = await getProjectMembers(projectId);
  const paperRows = await db
    .select({
      id: papers.id,
      title: papers.title,
      authorsText: papers.authorsText,
      year: papers.year,
      venue: papers.venue,
      rawBibtex: papers.rawBibtex
    })
    .from(papers)
    .where(eq(papers.projectId, projectId))
    .orderBy(desc(papers.updatedAt));

  const reviews = await db
    .select({
      id: paperReviews.id,
      paperId: paperReviews.paperId,
      reviewerId: paperReviews.reviewerId,
      decision: paperReviews.decision,
      reason: paperReviews.reason,
      updatedAt: paperReviews.updatedAt,
      reviewerName: users.displayName
    })
    .from(paperReviews)
    .innerJoin(users, eq(paperReviews.reviewerId, users.id))
    .where(eq(paperReviews.projectId, projectId));

  const byPaper = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const group = byPaper.get(review.paperId) ?? [];
    group.push(review);
    byPaper.set(review.paperId, group);
  }

  const rows = paperRows.map((paper) => {
    const paperReviewRows = byPaper.get(paper.id) ?? [];
    const completedCount = paperReviewRows.length;
    const reviewerCount = members.length;
    let summaryStatus:
      | "unreviewed"
      | "partially_reviewed"
      | "agreement_include"
      | "agreement_exclude"
      | "agreement_uncertain"
      | "conflict";

    if (completedCount === 0) {
      summaryStatus = "unreviewed";
    } else if (completedCount < reviewerCount) {
      summaryStatus = "partially_reviewed";
    } else {
      const decisions = [...new Set(paperReviewRows.map((review) => review.decision))];
      if (decisions.length === 1) {
        summaryStatus =
          decisions[0] === "included"
            ? "agreement_include"
            : decisions[0] === "excluded"
              ? "agreement_exclude"
              : "agreement_uncertain";
      } else {
        summaryStatus = "conflict";
      }
    }

    return {
      ...paper,
      summaryStatus,
      reviews: paperReviewRows
    };
  });

  const stats = {
    total: rows.length,
    unreviewed: rows.filter((row) => row.summaryStatus === "unreviewed").length,
    partiallyReviewed: rows.filter((row) => row.summaryStatus === "partially_reviewed").length,
    agreements: rows.filter((row) => row.summaryStatus.startsWith("agreement_")).length,
    conflicts: rows.filter((row) => row.summaryStatus === "conflict").length
  };

  return { members, rows, stats };
}

export async function getIncludedBibEntries(projectId: string) {
  const { rows } = await getProjectSummary(projectId);
  return rows
    .filter((row) => row.summaryStatus === "agreement_include")
    .map((row) => ({ rawBibtex: row.rawBibtex }));
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
      existingPaperTitle: papers.title
    })
    .from(importDuplicateLogs)
    .leftJoin(papers, eq(importDuplicateLogs.existingPaperId, papers.id))
    .innerJoin(importBatches, eq(importDuplicateLogs.batchId, importBatches.id));

  if (projectId) {
    conditions.push(eq(importBatches.projectId, projectId));
  }

  return query.where(and(...conditions));
}

export async function getUsersByIds(userIds: string[]) {
  const db = getDb();
  if (userIds.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, userIds));
}
