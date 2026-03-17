"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface UserRow {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
}

async function fetchUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return (await response.json()) as { users: UserRow[] };
}

async function sendJson(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) {
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

function UserCard({ user }: { user: UserRow }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => sendJson("PATCH", `/api/users/${user.id}`, { displayName }),
    onSuccess: async () => {
      setIsEditing(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["authUsers"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update user")
  });

  const deleteMutation = useMutation({
    mutationFn: async () => sendJson("DELETE", `/api/users/${user.id}`),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["authUsers"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete user")
  });

  return (
    <div className="rounded-xl border p-4" style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}>
      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Display Name</div>
          {isEditing ? (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
            />
          ) : (
            <div className="mt-1.5 text-base font-medium">{user.displayName}</div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">User ID</div>
          <div className="mt-1.5 text-xs text-[var(--text-muted)]">{user.id}</div>
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-[var(--excluded)]">{error}</div> : null}
      <div className="mt-3 flex gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              className="pill px-3 py-1.5 text-sm font-medium"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayName(user.displayName);
                setIsEditing(false);
              }}
              className="pill px-3 py-1.5 text-sm font-medium"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="pill px-3 py-1.5 text-sm font-medium"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          className="pill px-3 py-1.5 text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const createMutation = useMutation({
    mutationFn: async () => sendJson("POST", "/api/users", { displayName }),
    onSuccess: async () => {
      setDisplayName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["authUsers"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create user")
  });

  return (
    <main className="app-shell min-h-screen px-5 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="panel p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Internal</div>
          <h1 className="mt-2 text-xl font-semibold">Users</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Create and edit reviewer accounts manually. No main navigation entry is exposed.</p>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Create User</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              className="rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
            />
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!displayName.trim() || createMutation.isPending}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              Create
            </button>
          </div>
          {error ? <div className="mt-3 text-sm text-[var(--excluded)]">{error}</div> : null}
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Existing Users</h2>
          <div className="mt-4 space-y-3">
            {(usersQuery.data?.users ?? []).map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
