"use client";

import { useQuery } from "@tanstack/react-query";

export interface ImportBatch {
  id: string;
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

async function fetchImportBatches() {
  const response = await fetch("/api/import/batches");
  if (!response.ok) throw new Error("Failed to fetch import batches");
  return (await response.json()) as { batches: ImportBatch[] };
}

async function fetchBatchDuplicates(batchId: string) {
  const response = await fetch(`/api/import/batches?batchId=${batchId}`);
  if (!response.ok) throw new Error("Failed to fetch batch duplicates");
  return (await response.json()) as { duplicates: ImportDuplicateLog[] };
}

export function useImportLog() {
  return useQuery({
    queryKey: ["importBatches"],
    queryFn: fetchImportBatches
  });
}

export function useImportBatchDuplicates(batchId: string | null) {
  return useQuery({
    queryKey: ["importBatchDuplicates", batchId],
    queryFn: () => fetchBatchDuplicates(batchId!),
    enabled: !!batchId
  });
}
