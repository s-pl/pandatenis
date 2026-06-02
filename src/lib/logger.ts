type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function safeMeta(meta: LogMeta = {}) {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  );
}

export function log(level: LogLevel, event: string, meta: LogMeta = {}) {
  const payload = {
    level,
    event,
    at: new Date().toISOString(),
    ...safeMeta(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logError(event: string, error: unknown, meta: LogMeta = {}) {
  log("error", event, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
}
