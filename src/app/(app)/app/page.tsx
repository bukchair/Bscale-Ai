'use client';

import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { Dashboard } from '@/src/views/Dashboard';

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
