export const isValidDateValue = (value: unknown): value is string => {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
};

export const isExpiredTrialStatus = (data: Record<string, unknown> | undefined): boolean => {
  if (!data) return false;
  if (data.subscriptionStatus !== 'trial') return false;
  const trialEndsAt = data.trialEndsAt;
  if (!isValidDateValue(trialEndsAt)) return false;
  return Date.parse(trialEndsAt) <= Date.now();
};

export const stripUndefinedDeep = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) continue;
      const cleaned = stripUndefinedDeep(nestedValue as unknown);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    }
    return next as T;
  }
  return value;
};

export const isPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeCode =
    typeof (error as { code?: unknown }).code === 'string'
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';
  const maybeMessage =
    typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message?: unknown }).message).toLowerCase()
      : '';
  return maybeCode.includes('permission-denied') || maybeMessage.includes('missing or insufficient permissions');
};
