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
  const response = await fetch("/api/decisions");
  if (!response.ok) {
    throw new Error("Failed to fetch decision log");
  }
  return (await response.json()) as { decisions: DecisionLogItem[] };
}

export function useDecisionLog() {
  return useQuery({
    queryKey: ["decisions"],
    queryFn: fetchDecisionLog
  });
}
