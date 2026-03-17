"use client";

import { useQuery } from "@tanstack/react-query";

export interface SummaryReviewRow {
  id: string;
  paperId: string;
  reviewerId: string;
  reviewerName: string;
  decision: string;
  reason: string | null;
  updatedAt: string;
}

export interface SummaryPaperRow {
  id: string;
  title: string;
  authorsText: string | null;
  year: number | null;
  venue: string | null;
  summaryStatus:
    | "unreviewed"
    | "partially_reviewed"
    | "agreement_include"
    | "agreement_exclude"
    | "agreement_uncertain"
    | "conflict";
  reviews: SummaryReviewRow[];
}

export interface SummaryStats {
  total: number;
  unreviewed: number;
  partiallyReviewed: number;
  agreements: number;
  conflicts: number;
}

async function fetchProjectSummary(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/summary`);
  if (!response.ok) {
    throw new Error("Failed to fetch project summary");
  }
  return (await response.json()) as {
    rows: SummaryPaperRow[];
    stats: SummaryStats;
    members: Array<{ userId: string; displayName: string; role: string }>;
  };
}

export function useProjectSummary(projectId: string | null) {
  return useQuery({
    queryKey: ["projectSummary", projectId],
    queryFn: () => fetchProjectSummary(projectId as string),
    enabled: Boolean(projectId)
  });
}
