/**
 * Strips the `act_` prefix and non-digit characters from a Meta ad account ID,
 * returning the bare numeric string (or the original trimmed value if no digits found).
 */
export const normalizeMetaAccountId = (value: string): string => {
  const trimmed = String(value || '').replace(/^act_/i, '').trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly || trimmed;
};

/**
 * Returns the canonical `act_<id>` resource string for a Meta ad account.
 * Returns an empty string when the input is empty or invalid.
 */
export const toMetaAccountResource = (value: string): string => {
  const normalized = normalizeMetaAccountId(value);
  if (!normalized) return '';
  return `act_${normalized}`;
};
