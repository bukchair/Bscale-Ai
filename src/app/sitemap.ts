import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.bscale.co.il';

const staticRoutes: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
  { url: `${BASE_URL}/guide`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/articles`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/privacy-policy`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE_URL}/auth`, changeFrequency: 'monthly', priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes;
}
