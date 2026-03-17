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
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }
  return (await response.json()) as { stats: StatsData };
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats
  });
}
