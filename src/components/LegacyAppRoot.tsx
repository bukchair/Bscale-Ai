'use client';

import App from '@/src/App';

// Providers are now supplied by src/app/layout.tsx (via Providers component).
export function LegacyAppRoot() {
  return <App />;
}
