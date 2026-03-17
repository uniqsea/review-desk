"use client";

import { useQuery } from "@tanstack/react-query";

export interface CurrentUser {
  sessionId: string;
  userId: string;
  expiresAt: string;
  displayName: string;
  email: string | null;
  role: string;
}

async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }
  return (await response.json()) as { user: CurrentUser | null };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser
  });
}
