export const isRateLimitedErrorText = (message: string): boolean => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('too many calls') ||
    normalized.includes('"code":613')
  );
};
