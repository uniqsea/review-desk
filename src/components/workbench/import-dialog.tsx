"use client";

import { useState } from "react";
import type { DuplicateEntry, ImportPreview } from "@/lib/db/mutations";
import type { ProjectSummary } from "@/hooks/use-projects";

type Stage = "input" | "review" | "done";
type ImportMode = "new_project" | "existing_project";

interface CommitResult {
  projectId: string;
  imported: number;
  skipped: number;
  forceImported: number;
  failed: number;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "included" ? "var(--included)" : status === "excluded" ? "var(--excluded)" : "var(--pending)";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
      style={{ color, background: `${color}1A` }}
    >
      {status}
    </span>
  );
}

function DuplicateRow({
  dup,
  forced,
  onToggle
}: {
  dup: DuplicateEntry;
  forced: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">New entry</div>
          <div className="text-sm font-medium leading-snug">{dup.entry.title}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {dup.entry.firstAuthor}{dup.entry.year ? ` · ${dup.entry.year}` : ""}
          </div>
          {dup.entry.doi ? <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">{dup.entry.doi}</div> : null}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Existing</span>
            <StatusBadge status={dup.existingPaper.status} />
          </div>
          <div className="text-sm font-medium leading-snug">{dup.existingPaper.title}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {dup.existingPaper.firstAuthor}{dup.existingPaper.year ? ` · ${dup.existingPaper.year}` : ""}
          </div>
          {dup.existingPaper.doi ? <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">{dup.existingPaper.doi}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          Matched by <span className="font-semibold">{dup.matchReason}</span>
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={forced} onChange={onToggle} className="h-4 w-4 accent-[var(--accent)]" />
          Force import
        </label>
      </div>
    </div>
  );
}

export function ImportDialog({
  open,
  onClose,
  currentProjectId,
  projects,
  onImported
}: {
  open: boolean;
  onClose: () => void;
  currentProjectId: string | null;
  projects: ProjectSummary[];
  onImported: (projectId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<ImportMode>("existing_project");
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [forcedIndices, setForcedIndices] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<CommitResult | null>(null);

  if (!open) return null;

  const selectedProjectId = targetProjectId || currentProjectId || projects[0]?.id || "";

  const reset = () => {
    setStage("input");
    setMode("existing_project");
    setTargetProjectId(currentProjectId || projects[0]?.id || "");
    setProjectName("");
    setText("");
    setFile(null);
    setError(null);
    setPreview(null);
    setForcedIndices(new Set());
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const targetIsValid =
    mode === "new_project" ? projectName.trim().length > 0 : selectedProjectId.trim().length > 0;

  const runPreview = async (body: FormData | { text: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      let response: Response;
      if (body instanceof FormData) {
        body.append("mode", mode);
        if (mode === "new_project") {
          body.append("projectName", projectName.trim());
        } else {
          body.append("projectId", selectedProjectId);
        }
        response = await fetch("/api/import/bibtex/preview", { method: "POST", body });
      } else {
        response = await fetch("/api/import/bibtex/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            mode,
            projectId: mode === "existing_project" ? selectedProjectId : null,
            projectName: mode === "new_project" ? projectName.trim() : null
          })
        });
      }
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Preview failed");
      const data = json as ImportPreview;
      setPreview(data);

      // If no duplicates, commit immediately
      if (data.duplicates.length === 0) {
        await runCommit(data.batchToken, []);
      } else {
        setStage("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runCommit = async (batchToken: string, forceEntryIndices: number[]) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/import/bibtex/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchToken, forceEntryIndices })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Import failed");
      const data = json as CommitResult;
      setResult(data);
      setStage("done");
      onImported(data.projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleForce = (index: number) => {
    setForcedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (forcedIndices.size === preview.duplicates.length) {
      setForcedIndices(new Set());
    } else {
      setForcedIndices(new Set(preview.duplicates.map((d) => d.entryIndex)));
    }
  };

  const skippedCount = preview ? preview.duplicates.length - forcedIndices.size : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="panel w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 hairline-bottom">
          <div>
            <h2 className="text-xl font-semibold">Import BibTeX</h2>
            {stage === "input" && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">Create a new project or add entries to an existing project.</p>
            )}
            {stage === "review" && preview && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Found <span className="font-semibold text-[var(--pending)]">{preview.duplicates.length}</span> possible duplicate{preview.duplicates.length !== 1 ? "s" : ""}.
                Review and choose which to force import.
              </p>
            )}
            {stage === "done" && (
              <p className="mt-1 text-sm text-[var(--included)]">Import complete.</p>
            )}
          </div>
          <button type="button" onClick={handleClose} className="pill px-3 py-1.5 text-sm shrink-0">
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stage === "input" && (
            <div className="space-y-5">
              <div className="panel-muted rounded-2xl p-4">
                <div className="text-sm font-semibold">Import target</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-xl border px-4 py-3" style={{ borderWidth: "var(--hairline)", borderColor: mode === "new_project" ? "var(--accent)" : "var(--border)" }}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={mode === "new_project"}
                        onChange={() => setMode("new_project")}
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      />
                      <div>
                        <div className="text-sm font-medium">Create new project</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Import this BibTeX set as a new project.</div>
                      </div>
                    </div>
                  </label>
                  <label className="rounded-xl border px-4 py-3" style={{ borderWidth: "var(--hairline)", borderColor: mode === "existing_project" ? "var(--accent)" : "var(--border)" }}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={mode === "existing_project"}
                        onChange={() => setMode("existing_project")}
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      />
                      <div>
                        <div className="text-sm font-medium">Add to existing project</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Append entries to the selected project.</div>
                      </div>
                    </div>
                  </label>
                </div>

                {mode === "new_project" ? (
                  <div className="mt-4">
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="Project name"
                      className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
                      style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <select
                      value={selectedProjectId}
                      onChange={(event) => setTargetProjectId(event.target.value)}
                      className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
                      style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
              <div className="panel-muted rounded-2xl p-4">
                <div className="text-sm font-semibold">Upload file</div>
                <input
                  type="file"
                  accept=".bib"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-4 block w-full text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    runPreview(fd);
                  }}
                  disabled={!file || submitting || !targetIsValid}
                  className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  {submitting ? "Analyzing…" : "Preview Import"}
                </button>
              </div>

              <div className="panel-muted rounded-2xl p-4">
                <div className="text-sm font-semibold">Paste BibTeX</div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-4 h-40 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
                  placeholder="@article{...}"
                />
                <button
                  type="button"
                  onClick={() => runPreview({ text })}
                  disabled={!text.trim() || submitting || !targetIsValid}
                  className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  {submitting ? "Analyzing…" : "Preview Import"}
                </button>
              </div>
            </div>
            </div>
          )}

          {stage === "review" && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--text-muted)]">
                  {preview.toImportCount} new · {preview.duplicates.length} duplicates · {preview.failures.length} failed
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={forcedIndices.size === preview.duplicates.length}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Force import all
                </label>
              </div>
              <div className="space-y-3">
                {preview.duplicates.map((dup) => (
                  <DuplicateRow
                    key={dup.entryIndex}
                    dup={dup}
                    forced={forcedIndices.has(dup.entryIndex)}
                    onToggle={() => toggleForce(dup.entryIndex)}
                  />
                ))}
              </div>
            </div>
          )}

          {stage === "done" && result && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--included) 10%, transparent)" }}>
                <span className="text-base">✓</span>
                <span><span className="font-semibold">{result.imported}</span> papers imported into project</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--pending) 10%, transparent)" }}>
                  <span className="text-base">⊘</span>
                  <span><span className="font-semibold">{result.skipped}</span> duplicates skipped</span>
                </div>
              )}
              {result.forceImported > 0 && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                  <span className="text-base">↑</span>
                  <span><span className="font-semibold">{result.forceImported}</span> duplicates force-imported</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--excluded) 10%, transparent)" }}>
                  <span className="text-base">✕</span>
                  <span><span className="font-semibold">{result.failed}</span> entries failed to parse</span>
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-4 text-sm" style={{ color: "var(--excluded)" }}>{error}</div>}
        </div>

        {/* Footer actions */}
        {stage === "review" && preview && (
          <div className="hairline-top flex items-center justify-between px-6 py-4">
            <button type="button" onClick={() => setStage("input")} className="pill px-4 py-2 text-sm font-medium">
              Back
            </button>
            <button
              type="button"
              onClick={() => runCommit(preview.batchToken, Array.from(forcedIndices))}
              disabled={submitting}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              {submitting
                ? "Importing…"
                : skippedCount > 0
                  ? `Confirm (skip ${skippedCount})`
                  : "Confirm Import"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
