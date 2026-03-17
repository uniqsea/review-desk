"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImportDialog } from "./import-dialog";
import { LogDrawer } from "./log-drawer";
import { PaperDetail } from "./paper-detail";
import { PaperList } from "./paper-list";
import { ProcessedList } from "./processed-list";
import { useDecisionLog } from "@/hooks/use-decision-log";
import { useImportLog } from "@/hooks/use-import-log";
import { usePaperDetail } from "@/hooks/use-paper-detail";
import { usePapers } from "@/hooks/use-papers";
import { useStats } from "@/hooks/use-stats";

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : json.details?.fieldErrors?.reason?.[0] ??
          json.details?.formErrors?.[0] ??
          "Request failed";
    throw new Error(message);
  }
  return json;
}

type ActiveSide = "pending" | "processed";

export function WorkbenchPage() {
  const queryClient = useQueryClient();

  const [activeSide, setActiveSide] = useState<ActiveSide>("pending");
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Left: pending only
  const [pendingSearch, setPendingSearch] = useState("");
  const pendingQuery = usePapers("pending", pendingSearch);
  const pendingPapers = pendingQuery.data?.papers ?? [];

  // Right: processed
  const [processedFilter, setProcessedFilter] = useState<"all" | "included" | "excluded" | "uncertain">("all");
  const [processedSearch, setProcessedSearch] = useState("");
  const processedStatus = processedFilter === "all" ? "processed" : processedFilter;
  const processedQuery = usePapers(processedStatus, processedSearch);
  const processedPapers = processedQuery.data?.papers ?? [];

  const statsQuery = useStats();
  const stats = statsQuery.data?.stats;
  const detailQuery = usePaperDetail(selectedPaperId);
  const decisionLogQuery = useDecisionLog();
  const importLogQuery = useImportLog();

  // Auto-select first pending paper
  useEffect(() => {
    if (activeSide !== "pending") return;
    if (!selectedPaperId && pendingPapers.length > 0) {
      setSelectedPaperId(pendingPapers[0]?.id ?? null);
      return;
    }
    if (selectedPaperId && pendingPapers.every((p) => p.id !== selectedPaperId)) {
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
      queryClient.invalidateQueries({ queryKey: ["decisions"] }),
      queryClient.invalidateQueries({ queryKey: ["paper"] }),
      queryClient.invalidateQueries({ queryKey: ["importBatches"] })
    ]);
  };

  const decisionMutation = useMutation({
    mutationFn: async ({ decision, reasonText }: { decision: "included" | "excluded" | "uncertain"; reasonText: string }) =>
      postJson(`/api/papers/${selectedPaperId}/decision`, { decision, reason: reasonText }),
    onSuccess: async (data) => {
      setReason("");
      setError(null);
      await refreshAll();
      if (activeSide === "pending") {
        setSelectedPaperId(data.nextPendingPaperId ?? null);
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to save decision")
  });

  const undoMutation = useMutation({
    mutationFn: async () => postJson(`/api/papers/${selectedPaperId}/undo`),
    onSuccess: async () => { setError(null); await refreshAll(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to undo")
  });

  const working = decisionMutation.isPending || undoMutation.isPending;

  const selectPending = (id: string) => { setActiveSide("pending"); setSelectedPaperId(id); setReason(""); };
  const selectProcessed = (id: string) => { setActiveSide("processed"); setSelectedPaperId(id); setReason(""); };

  return (
    <main className="app-shell h-screen overflow-hidden px-5 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col gap-5">

        {/* Header */}
        <section className="panel px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5 min-w-0">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">PRISMA Screening</div>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight">Title / Abstract Screening</h1>
              </div>
              {stats && (
                <>
                  <div className="hidden xl:block h-7 w-px bg-[var(--border)]" />
                  <div className="hidden xl:flex items-center gap-3 text-xs">
                    <span className="text-[var(--text-muted)]"><strong className="text-[var(--text)]">{stats.total}</strong> papers</span>
                    <span style={{ color: "var(--pending)" }}>{stats.pending} pending</span>
                    <span style={{ color: "var(--included)" }}>{stats.included} included</span>
                    <span style={{ color: "var(--excluded)" }}>{stats.excluded} excluded</span>
                    {(stats.uncertain ?? 0) > 0 && <span style={{ color: "var(--pending)" }}>{stats.uncertain} uncertain</span>}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                Import BibTeX
              </button>
              <button type="button" onClick={() => window.open("/api/export/csv", "_blank")} className="pill px-4 py-2 text-sm font-medium">
                Export CSV
              </button>
              <button type="button" onClick={() => window.open("/api/export/included-bib", "_blank")} className="pill px-4 py-2 text-sm font-medium">
                Export .bib
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="panel px-5 py-3 text-sm" style={{ color: "var(--excluded)" }}>{error}</div>
        ) : null}

        {/* Three-column layout */}
        <section className="grid min-h-0 flex-1 gap-5 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <div className="min-h-0">
            <PaperList
              search={pendingSearch}
              onSearchChange={setPendingSearch}
              papers={pendingPapers}
              selectedPaperId={activeSide === "pending" ? selectedPaperId : null}
              onSelectPaper={selectPending}
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
              onSelectPaper={selectProcessed}
            />
          </div>
        </section>
      </div>

      <LogDrawer
        open={showLog}
        onClose={() => setShowLog(false)}
        decisions={decisionLogQuery.data?.decisions ?? []}
        importBatches={importLogQuery.data?.batches ?? []}
      />

      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={async () => {
          await refreshAll();
          setSelectedPaperId(null);
          setActiveSide("pending");
        }}
      />
    </main>
  );
}
