export const hasRequiredScopes = (
  grantedScopes: string[] | undefined | null,
  requiredScopes: readonly string[]
): { ok: boolean; missingScopes: string[] } => {
  const granted = new Set(grantedScopes ?? []);
  const missingScopes = requiredScopes.filter((scope) => !granted.has(scope));
  return {
    ok: missingScopes.length === 0,
    missingScopes,
  };
};
