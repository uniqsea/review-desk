"use client";

import { useQuery } from "@tanstack/react-query";

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: "owner" | "reviewer";
  createdAt: string;
  displayName: string;
  email: string | null;
}

async function fetchProjectMembers(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/members`);
  if (!response.ok) {
    throw new Error("Failed to fetch project members");
  }
  return (await response.json()) as { members: ProjectMember[] };
}

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ["projectMembers", projectId],
    queryFn: () => fetchProjectMembers(projectId as string),
    enabled: Boolean(projectId)
  });
}
