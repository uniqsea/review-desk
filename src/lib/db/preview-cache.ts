import type { NormalizedPaperInput } from "@/lib/bibtex/normalize";

// Inline to avoid circular dependency with mutations.ts
interface CacheEntry {
  preview: {
    batchToken: string;
    mode: "new_project" | "existing_project";
    projectId?: string;
    projectName?: string;
    toImportCount: number;
    duplicates: Array<{
      entryIndex: number;
      entry: NormalizedPaperInput;
      existingPaper: { id: string; title: string; firstAuthor: string | null; year: number | null; doi: string | null; status: string };
      matchReason: "doi" | "title";
    }>;
    failures: Array<{ raw: string; error: string }>;
    sourceType: "file" | "text";
    filename?: string | null;
    rawInput: string;
    rawCount: number;
  };
  validEntries: NormalizedPaperInput[];
  expiresAt: number;
}

// Use globalThis to share across Next.js hot-reload module boundaries
const g = globalThis as typeof globalThis & { __previewCache?: Map<string, CacheEntry> };
if (!g.__previewCache) {
  g.__previewCache = new Map();
}

export const previewCache = g.__previewCache;
export type { CacheEntry as PreviewCacheEntry };
