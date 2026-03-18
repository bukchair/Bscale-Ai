import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  typescript: {
    // ignoreBuildErrors is required for the hybrid Vite + Next.js architecture.
    // The build script temporarily moves src/pages → src/__vite_pages_for_next_build__/
    // and rewrites App.tsx imports; TypeScript follows those import chains and picks
    // up Vite-only client modules (metaService, firebase, etc.) that are not in scope
    // for the Next.js server runtime.
    ignoreBuildErrors: true,
    tsconfigPath: 'tsconfig.next.json',
  },
};

export default nextConfig;
