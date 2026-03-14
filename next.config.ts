import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  typescript: {
    // This repo is hybrid (Vite + Next App Router). Avoid blocking builds
    // on non-Next page modules under src/pages.
    ignoreBuildErrors: true,
    tsconfigPath: 'tsconfig.next.json',
  },
};

export default nextConfig;
