"use client";

import { useQuery } from "@tanstack/react-query";

export interface StatsData {
  total: number;
  included: number;
  excluded: number;
  pending: number;
  uncertain: number;
  percentages: {
    included: number;
    excluded: number;
    pending: number;
  };
}

async function fetchStats() {
  throw new Error("projectId is required");
}

async function fetchStatsForProject(projectId: string) {
  const response = await fetch(`/api/stats?${new URLSearchParams({ projectId }).toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }
  return (await response.json()) as { stats: StatsData };
}

export function useStats(projectId: string | null) {
  return useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => fetchStatsForProject(projectId as string),
    enabled: Boolean(projectId)
  });
}
