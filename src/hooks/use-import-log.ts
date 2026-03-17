"use client";

import { useQuery } from "@tanstack/react-query";

export interface ImportBatch {
  id: string;
  projectId: string;
  sourceType: "file" | "text";
  filename: string | null;
  rawCount: number;
  parsedCount: number;
  failedCount: number;
  duplicateCount: number;
  skippedCount: number;
  createdAt: string;
}

export interface ImportDuplicateLog {
  id: string;
  newTitle: string;
  newDoi: string | null;
  matchReason: string;
  action: "skipped" | "force_imported";
  existingPaperTitle: string | null;
  existingPaperStatus: string | null;
}

async function fetchImportBatches(projectId: string) {
  const response = await fetch(`/api/import/batches?${new URLSearchParams({ projectId }).toString()}`);
  if (!response.ok) throw new Error("Failed to fetch import batches");
  return (await response.json()) as { batches: ImportBatch[] };
}

async function fetchBatchDuplicates(projectId: string, batchId: string) {
  const response = await fetch(`/api/import/batches?${new URLSearchParams({ projectId, batchId }).toString()}`);
  if (!response.ok) throw new Error("Failed to fetch batch duplicates");
  return (await response.json()) as { duplicates: ImportDuplicateLog[] };
}

export function useImportLog(projectId: string | null) {
  return useQuery({
    queryKey: ["importBatches", projectId],
    queryFn: () => fetchImportBatches(projectId as string),
    enabled: !!projectId
  });
}

export function useImportBatchDuplicates(projectId: string | null, batchId: string | null) {
  return useQuery({
    queryKey: ["importBatchDuplicates", projectId, batchId],
    queryFn: () => fetchBatchDuplicates(projectId!, batchId!),
    enabled: !!projectId && !!batchId
  });
}
