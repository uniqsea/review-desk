import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_PATH = path.join(LOG_DIR, "activity.log");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendLine(line: string) {
  ensureLogDir();
  fs.appendFileSync(LOG_PATH, line + "\n", "utf8");
}

export function logDecision({
  title,
  fromStatus,
  toStatus,
  reason
}: {
  title: string;
  fromStatus: string;
  toStatus: string;
  reason?: string | null;
}) {
  const ts = new Date().toISOString();
  const reasonPart = reason ? ` | reason: ${reason}` : "";
  appendLine(`[${ts}] DECISION  "${title}"  ${fromStatus} → ${toStatus}${reasonPart}`);
}

export function logUndo({
  title,
  fromStatus,
  toStatus
}: {
  title: string;
  fromStatus: string;
  toStatus: string;
}) {
  const ts = new Date().toISOString();
  appendLine(`[${ts}] UNDO      "${title}"  ${fromStatus} → ${toStatus}`);
}

export function logImport({
  label,
  imported,
  skipped,
  failed,
  duplicates
}: {
  label: string;
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
}) {
  const ts = new Date().toISOString();
  appendLine(`[${ts}] IMPORT    "${label}"  imported:${imported} skipped:${skipped} failed:${failed} duplicates:${duplicates}`);
}
