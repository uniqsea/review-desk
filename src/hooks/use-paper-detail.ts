"use client";

import { useQuery } from "@tanstack/react-query";

export interface PaperDetailData {
  id: string;
  projectId: string;
  title: string;
  authorsText: string | null;
  firstAuthor: string | null;
  year: number | null;
  venue: string | null;
  abstract: string | null;
  keywordsText: string | null;
  doi: string | null;
  status: "pending" | "included" | "excluded" | "uncertain";
  latestDecisionId: string | null;
  latestDecisionReason: string | null;
  latestDecisionTimestamp: string | null;
}

async function fetchPaper(id: string, projectId: string) {
  const response = await fetch(`/api/papers/${id}?${new URLSearchParams({ projectId }).toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch paper");
  }
  return (await response.json()) as { paper: PaperDetailData };
}

export function usePaperDetail(id: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ["paper", projectId, id],
    queryFn: () => fetchPaper(id as string, projectId as string),
    enabled: Boolean(id && projectId)
  });
}
