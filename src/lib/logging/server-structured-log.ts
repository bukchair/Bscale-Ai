/**
 * Single-line JSON to stdout/stderr so entries appear in Cloud Run / Cloud Logging.
 * Searching by `userEmail` in the logs UI (textPayload) will match these lines.
 */
export function logWithUserContext(
  level: 'ERROR' | 'WARNING' | 'INFO',
  message: string,
  ctx?: { userEmail?: string | null; userId?: string | null; path?: string }
) {
  const payload = {
    severity: level,
    message,
    userEmail: ctx?.userEmail || undefined,
    userId: ctx?.userId || undefined,
    path: ctx?.path || undefined,
    ts: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARNING') console.warn(line);
  else console.log(line);
}
