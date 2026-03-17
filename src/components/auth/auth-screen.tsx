"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Request failed");
  }
  return json;
}

export function AuthScreen() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["authUsers"], queryFn: fetchUsers });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () => postJson("/api/auth/login", { userId: selectedUserId }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Login failed")
  });

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="panel w-full max-w-lg p-8">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">PRISMA Screening</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Internal Access</h1>

        <div className="mt-6 rounded-2xl border p-4" style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}>
          <div className="text-sm font-semibold">Login</div>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
          >
            <option value="">Select user</option>
            {(usersQuery.data?.users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loginMutation.mutate()}
            disabled={!selectedUserId || loginMutation.isPending}
            className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {loginMutation.isPending ? "Logging in…" : "Login"}
          </button>
        </div>

        {error ? <div className="mt-3 text-sm text-[var(--excluded)]">{error}</div> : null}
      </div>
    </main>
  );
}
