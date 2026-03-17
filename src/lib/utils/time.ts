export function nowIso() {
  return new Date().toISOString();
}

export function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}
