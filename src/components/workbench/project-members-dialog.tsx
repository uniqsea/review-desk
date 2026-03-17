"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectMember } from "@/hooks/use-project-members";

interface UserOption {
  id: string;
  displayName: string;
}

async function fetchUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return (await response.json()) as { users: UserOption[] };
}

async function sendJson(method: "POST" | "DELETE", url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Request failed");
  }
  return json;
}

export function ProjectMembersDialog({
  open,
  onClose,
  projectId,
  members,
  canManage
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  members: ProjectMember[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: open && canManage });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async () => sendJson("POST", `/api/projects/${projectId}/members`, { userId: selectedUserId }),
    onSuccess: async () => {
      setSelectedUserId("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["projectMembers", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projectSummary", projectId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to invite member")
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => sendJson("DELETE", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["projectMembers", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projectSummary", projectId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to remove member")
  });

  if (!open) return null;

  const currentMemberIds = new Set(members.map((member) => member.userId));
  const inviteableUsers = (usersQuery.data?.users ?? []).filter((user) => !currentMemberIds.has(user.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="panel w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Project Members</h2>
          </div>
          <button type="button" onClick={onClose} className="pill px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        {canManage ? (
          <div className="mt-5 flex gap-3">
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
            >
              <option value="">Select user</option>
              {inviteableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => inviteMutation.mutate()}
              disabled={!selectedUserId || inviteMutation.isPending}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              Invite
            </button>
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm text-[var(--excluded)]">{error}</div> : null}

        <div className="mt-5 space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-sm font-medium">{member.displayName}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {member.role}
                </div>
              </div>
              {canManage && member.role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(member.userId)}
                  disabled={removeMutation.isPending}
                  className="pill px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
