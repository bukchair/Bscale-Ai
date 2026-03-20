import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  typescript: {
    tsconfigPath: 'tsconfig.next.json',
  },
};

export default nextConfig;
