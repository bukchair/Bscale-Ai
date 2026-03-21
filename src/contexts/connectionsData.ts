import type { Connection } from './ConnectionsContext';

export const AI_CONNECTION_IDS = ['gemini', 'openai', 'claude'] as const;
export const PLATFORM_CONNECTION_IDS = ['google', 'meta', 'tiktok', 'woocommerce', 'shopify'] as const;
export const ADMIN_SALES_EMAIL = 'asher205@gmail.com';

export const initialConnections: Connection[] = [
  {
    id: 'gemini',
    name: 'integrations.platforms.gemini.name',
    category: 'AI Engine',
    status: 'disconnected',
    description: 'integrations.platforms.gemini.desc',
  },
  {
    id: 'openai',
    name: 'integrations.platforms.openai.name',
    category: 'AI Engine',
    status: 'disconnected',
    description: 'integrations.platforms.openai.desc',
  },
  {
    id: 'claude',
    name: 'integrations.platforms.claude.name',
    category: 'AI Engine',
    status: 'disconnected',
    description: 'integrations.platforms.claude.desc',
  },
  {
    id: 'google',
    name: 'integrations.platforms.google.name',
    category: 'Google',
    status: 'disconnected',
    description: 'integrations.platforms.google.desc',
    subConnections: [
      { id: 'google_ads', name: 'Google Ads', status: 'disconnected' },
      { id: 'ga4', name: 'Google Analytics 4', status: 'disconnected' },
      { id: 'gsc', name: 'Search Console', status: 'disconnected' },
      { id: 'gmail', name: 'Gmail / Reports', status: 'disconnected' },
    ],
  },
  {
    id: 'meta',
    name: 'integrations.platforms.meta.name',
    category: 'Social',
    status: 'disconnected',
    description: 'integrations.platforms.meta.desc',
  },
  {
    id: 'tiktok',
    name: 'integrations.platforms.tiktok.name',
    category: 'Social',
    status: 'disconnected',
    description: 'integrations.platforms.tiktok.desc',
  },
  {
    id: 'woocommerce',
    name: 'integrations.platforms.woocommerce.name',
    category: 'E-commerce',
    status: 'disconnected',
    description: 'integrations.platforms.woocommerce.desc',
  },
  {
    id: 'shopify',
    name: 'integrations.platforms.shopify.name',
    category: 'E-commerce',
    status: 'disconnected',
    description: 'integrations.platforms.shopify.desc',
  },
];
