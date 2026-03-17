import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";

export async function getProjectMembership(projectId: string, userId: string) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  return membership ?? null;
}

export async function requireProjectMembership(projectId: string, userId: string) {
  const membership = await getProjectMembership(projectId, userId);
  if (!membership) {
    throw new Error("Forbidden");
  }
  return membership;
}

export async function requireProjectOwner(projectId: string, userId: string) {
  const membership = await requireProjectMembership(projectId, userId);
  if (membership.role !== "owner") {
    throw new Error("Forbidden");
  }
  return membership;
}
