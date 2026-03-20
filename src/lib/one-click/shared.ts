/** Shared utilities for one-click campaign builders. */

export const sanitize = (v: string, maxLen = 120) =>
  String(v || '').trim().slice(0, maxLen);

export const extractError = async (res: Response): Promise<string> => {
  const raw = await res.text().catch(() => '');
  if (!raw) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const e = parsed?.error as Record<string, unknown> | undefined;
    const d = parsed?.data as Record<string, unknown> | undefined;
    return (
      String(e?.message || parsed?.message || d?.message || '').trim() ||
      raw.slice(0, 260)
    );
  } catch {
    return raw.slice(0, 260);
  }
};
