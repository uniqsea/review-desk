"use client";

import { useQuery } from "@tanstack/react-query";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt?: string;
  paperCount: number;
  role: "owner" | "reviewer";
}

async function fetchProjects() {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  return (await response.json()) as { projects: ProjectSummary[] };
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects
  });
}
