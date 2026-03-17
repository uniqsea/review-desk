"use client";

import { useQuery } from "@tanstack/react-query";

export interface DecisionLogItem {
  id: string;
  paperId: string;
  title: string;
  reason: string | null;
  createdAt: string;
  kind: "decision" | "undo";
  fromStatus: "pending" | "included" | "excluded" | "uncertain";
  toStatus: "pending" | "included" | "excluded" | "uncertain";
  isActive: boolean;
  targetDecisionId: string | null;
  userDisplayName: string;
}

async function fetchDecisionLog() {
  throw new Error("projectId is required");
}

async function fetchDecisionLogForProject(projectId: string) {
  const response = await fetch(`/api/decisions?${new URLSearchParams({ projectId }).toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch decision log");
  }
  return (await response.json()) as { decisions: DecisionLogItem[] };
}

export function useDecisionLog(projectId: string | null) {
  return useQuery({
    queryKey: ["decisions", projectId],
    queryFn: () => fetchDecisionLogForProject(projectId as string),
    enabled: Boolean(projectId)
  });
}
