"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthScreen } from "@/components/auth/auth-screen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePaperDetail } from "@/hooks/use-paper-detail";
import { usePapers } from "@/hooks/use-papers";
import { useProjectMembers } from "@/hooks/use-project-members";
import { useProjects } from "@/hooks/use-projects";
import { useStats } from "@/hooks/use-stats";
import { ImportDialog } from "./import-dialog";
import { PaperDetail } from "./paper-detail";
import { PaperList } from "./paper-list";
import { ProcessedList } from "./processed-list";
import { ProjectMembersDialog } from "./project-members-dialog";

async function sendJson(method: "POST" | "PATCH", url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json.error === "string" ? json.error : "Request failed";
    throw new Error(message);
  }
  return json;
}

type ActiveSide = "pending" | "processed";

function RenameProjectDialog({
  open,
  initialName,
  onClose,
  onSubmit,
  isSubmitting
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="panel w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Rename Project</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Update the current project name.</p>
          </div>
          <button type="button" onClick={onClose} className="pill px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Project name"
          className="mt-5 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
          style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
        />

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="pill px-4 py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(name)}
            disabled={!name.trim() || isSubmitting}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkbenchPage({ initialProjectId = null }: { initialProjectId?: string | null }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data?.user ?? null;

  const [activeSide, setActiveSide] = useState<ActiveSide>("pending");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectsQuery = useProjects();
  const projects = projectsQuery.data?.projects ?? [];
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null;
  const canManageMembers = currentProject?.role === "owner";

  const membersQuery = useProjectMembers(currentProjectId);
  const members = membersQuery.data?.members ?? [];

  const [pendingSearch, setPendingSearch] = useState("");
  const pendingQuery = usePapers(currentProjectId, "pending", pendingSearch);
  const pendingPapers = pendingQuery.data?.papers ?? [];

  const [processedFilter, setProcessedFilter] = useState<"all" | "included" | "excluded" | "uncertain">("all");
  const [processedSearch, setProcessedSearch] = useState("");
  const processedStatus = processedFilter === "all" ? "processed" : processedFilter;
  const processedQuery = usePapers(currentProjectId, processedStatus, processedSearch);
  const processedPapers = processedQuery.data?.papers ?? [];

  const statsQuery = useStats(currentProjectId);
  const stats = statsQuery.data?.stats;
  const detailQuery = usePaperDetail(selectedPaperId, currentProjectId);

  useEffect(() => {
    if (!currentUser || projects.length === 0) return;
    const storedProjectId = typeof window !== "undefined" ? window.localStorage.getItem("currentProjectId") : null;
    const routeProjectId =
      initialProjectId && projects.some((project) => project.id === initialProjectId) ? initialProjectId : null;
    const fallbackProjectId =
      routeProjectId ||
      (storedProjectId && projects.some((project) => project.id === storedProjectId)
        ? storedProjectId
        : projects[0]?.id ?? null);

    setCurrentProjectId((prev) => prev ?? fallbackProjectId);
  }, [currentUser, projects, initialProjectId]);

  useEffect(() => {
    if (!currentProjectId || typeof window === "undefined") return;
    window.localStorage.setItem("currentProjectId", currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) return;
    const targetPath = `/projects/${currentProjectId}/review`;
    if (pathname !== targetPath) {
      router.replace(targetPath as never);
    }
  }, [currentProjectId, pathname, router]);

  useEffect(() => {
    setSelectedPaperId(null);
    setReason("");
    setPendingSearch("");
    setProcessedSearch("");
    setActiveSide("pending");
  }, [currentProjectId]);

  useEffect(() => {
    if (activeSide !== "pending") return;
    if (!selectedPaperId && pendingPapers.length > 0) {
      setSelectedPaperId(pendingPapers[0]?.id ?? null);
      return;
    }
    if (selectedPaperId && pendingPapers.every((paper) => paper.id !== selectedPaperId)) {
      setSelectedPaperId(pendingPapers[0]?.id ?? null);
    }
  }, [pendingPapers, selectedPaperId, activeSide]);

  useEffect(() => {
    const paper = detailQuery.data?.paper;
    if (!paper) return;
    setReason(paper.latestDecisionReason ?? "");
  }, [detailQuery.data?.paper?.id, detailQuery.data?.paper?.latestDecisionReason]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["papers"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
      queryClient.invalidateQueries({ queryKey: ["paper"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["projectSummary"] }),
      queryClient.invalidateQueries({ queryKey: ["projectMembers"] }),
      queryClient.invalidateQueries({ queryKey: ["importBatches"] })
    ]);
  };

  const decisionMutation = useMutation({
    mutationFn: async ({ decision, reasonText }: { decision: "included" | "excluded" | "uncertain"; reasonText: string }) =>
      sendJson("POST", `/api/papers/${selectedPaperId}/decision`, { decision, reason: reasonText, projectId: currentProjectId }),
    onSuccess: async (data) => {
      setReason("");
      setError(null);
      await refreshAll();
      if (activeSide === "pending") {
        setSelectedPaperId(data.nextPendingPaperId ?? null);
      }
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save decision")
  });

  const undoMutation = useMutation({
    mutationFn: async () => sendJson("POST", `/api/papers/${selectedPaperId}/undo`, { projectId: currentProjectId }),
    onSuccess: async () => {
      setError(null);
      await refreshAll();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to undo")
  });

  const renameProjectMutation = useMutation({
    mutationFn: async (name: string) => sendJson("PATCH", `/api/projects/${currentProjectId}`, { name }),
    onSuccess: async () => {
      setError(null);
      setShowRenameProject(false);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to rename project")
  });

  const logoutMutation = useMutation({
    mutationFn: async () => sendJson("POST", "/api/auth/logout"),
    onSuccess: async () => {
      setCurrentProjectId(null);
      setSelectedPaperId(null);
      await queryClient.clear();
      window.location.reload();
    }
  });

  const working = decisionMutation.isPending || undoMutation.isPending;

  if (currentUserQuery.isLoading) {
    return <main className="app-shell flex min-h-screen items-center justify-center">Loading…</main>;
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <main className="app-shell h-screen overflow-hidden px-5 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col gap-5">
        <section className="panel px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">PRISMA Screening</div>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight">Reviewer Workspace</h1>
              </div>
              <div className="hidden h-7 w-px bg-[var(--border)] xl:block" />
              <div className="min-w-[240px]">
                <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Current Project</div>
                <div className="flex gap-2">
                  <select
                    value={currentProjectId ?? ""}
                    onChange={(event) => {
                      const nextProjectId = event.target.value || null;
                      setCurrentProjectId(nextProjectId);
                    }}
                    className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {canManageMembers ? (
                    <button
                      type="button"
                      onClick={() => setShowRenameProject(true)}
                      className="pill px-3 py-2 text-sm font-medium"
                    >
                      Rename
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium">{currentUser.displayName}</div>
              </div>
              <button type="button" onClick={() => setShowMembers(true)} className="pill px-4 py-2 text-sm font-medium">
                Members
              </button>
              {currentProjectId ? (
                <Link href={`/projects/${currentProjectId}/summary`} className="pill px-4 py-2 text-sm font-medium">
                  Summary
                </Link>
              ) : null}
              <button type="button" onClick={() => setShowImport(true)} className="pill px-4 py-2 text-sm font-medium">
                Import BibTeX
              </button>
              <button
                type="button"
                onClick={() => window.open(`/api/export/csv?projectId=${currentProjectId}`, "_blank")}
                className="pill px-4 py-2 text-sm font-medium"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.open(`/api/export/included-bib?projectId=${currentProjectId}`, "_blank")}
                className="pill px-4 py-2 text-sm font-medium"
              >
                Export .bib
              </button>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="pill px-4 py-2 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>

          {stats ? (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span>{stats.total} papers</span>
              <span className="text-[var(--pending)]">{stats.pending} pending</span>
              <span className="text-[var(--included)]">{stats.included} included</span>
              <span className="text-[var(--excluded)]">{stats.excluded} excluded</span>
              <span className="text-[var(--pending)]">{stats.uncertain} uncertain</span>
            </div>
          ) : null}
        </section>

        {error ? <div className="text-sm text-[var(--excluded)]">{error}</div> : null}

        <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[420px_minmax(0,1fr)_420px] overflow-hidden">
          <div className="min-h-0">
            <PaperList
              search={pendingSearch}
              onSearchChange={setPendingSearch}
              papers={pendingPapers}
              selectedPaperId={activeSide === "pending" ? selectedPaperId : null}
              onSelectPaper={(paperId) => {
                setActiveSide("pending");
                setSelectedPaperId(paperId);
                setReason("");
              }}
              totalPending={stats?.pending}
            />
          </div>

          <div className="min-h-0">
            <PaperDetail
              paper={detailQuery.data?.paper}
              reason={reason}
              onReasonChange={setReason}
              onInclude={() => decisionMutation.mutate({ decision: "included", reasonText: reason })}
              onExclude={() => decisionMutation.mutate({ decision: "excluded", reasonText: reason })}
              onUncertain={() => decisionMutation.mutate({ decision: "uncertain", reasonText: reason })}
              onUndo={() => undoMutation.mutate()}
              isMutating={working}
            />
          </div>

          <div className="min-h-0">
            <ProcessedList
              filter={processedFilter}
              onFilterChange={setProcessedFilter}
              search={processedSearch}
              onSearchChange={setProcessedSearch}
              papers={processedPapers}
              selectedPaperId={activeSide === "processed" ? selectedPaperId : null}
              onSelectPaper={(paperId) => {
                setActiveSide("processed");
                setSelectedPaperId(paperId);
                setReason("");
              }}
            />
          </div>
        </section>
      </div>

      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        currentProjectId={currentProjectId}
        projects={projects}
        onImported={(projectId) => {
          setCurrentProjectId(projectId);
          refreshAll();
          setShowImport(false);
        }}
      />

      <RenameProjectDialog
        open={showRenameProject}
        initialName={currentProject?.name ?? ""}
        onClose={() => setShowRenameProject(false)}
        onSubmit={(name) => renameProjectMutation.mutate(name)}
        isSubmitting={renameProjectMutation.isPending}
      />

      <ProjectMembersDialog
        open={showMembers}
        onClose={() => setShowMembers(false)}
        projectId={currentProjectId}
        members={members}
        canManage={Boolean(canManageMembers)}
      />
    </main>
  );
}
