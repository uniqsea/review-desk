import type { PaperStatus } from "@/lib/db/schema";

export function getStatusAfterUndo(statuses: PaperStatus[]) {
  return statuses.at(-1) ?? "pending";
}
