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

async function fetchPapers(status: PaperListStatus, q: string) {
  const params = new URLSearchParams({ status, q });
  const response = await fetch(`/api/papers?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch papers");
  }
  return (await response.json()) as { papers: PaperListItemData[] };
}

export function usePapers(status: PaperListStatus, q: string) {
  return useQuery({
    queryKey: ["papers", status, q],
    queryFn: () => fetchPapers(status, q)
  });
}
