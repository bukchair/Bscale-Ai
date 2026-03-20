'use client';

import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { Dashboard } from '@/src/pages/Dashboard';

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
