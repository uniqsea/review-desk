import type { PaperStatus } from "@/lib/db/schema";

export function getStatusColor(status: PaperStatus) {
  if (status === "included") return "var(--included)";
  if (status === "excluded") return "var(--excluded)";
  return "var(--pending)";
}

export function getStatusLabel(status: PaperStatus) {
  return status[0].toUpperCase() + status.slice(1);
}
