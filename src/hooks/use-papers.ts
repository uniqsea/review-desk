"use client";

import { useQuery } from "@tanstack/react-query";

export type PaperListStatus = "all" | "pending" | "included" | "excluded" | "uncertain" | "processed";

export interface PaperListItemData {
  id: string;
  title: string;
  firstAuthor: string | null;
  year: number | null;
  venue: string | null;
  status: "pending" | "included" | "excluded" | "uncertain";
}

async function fetchPapers(projectId: string, status: PaperListStatus, q: string) {
  const params = new URLSearchParams({ projectId, status, q });
  const response = await fetch(`/api/papers?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch papers");
  }
  return (await response.json()) as { papers: PaperListItemData[] };
}

export function usePapers(projectId: string | null, status: PaperListStatus, q: string) {
  return useQuery({
    queryKey: ["papers", projectId, status, q],
    queryFn: () => fetchPapers(projectId as string, status, q),
    enabled: Boolean(projectId)
  });
}
