import type { ReactNode } from 'react';
import { PublicTopNav } from '@/src/components/PublicTopNav';
import { SalesBot } from '@/src/components/SalesBot';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicTopNav />
      {children}
      <SalesBot />
    </>
  );
}
