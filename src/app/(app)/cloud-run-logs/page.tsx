'use client';

import { CloudRunLogs } from '@/src/pages/CloudRunLogs';
import { Dashboard } from '@/src/pages/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function CloudRunLogsPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <CloudRunLogs /> : <Dashboard />;
}
