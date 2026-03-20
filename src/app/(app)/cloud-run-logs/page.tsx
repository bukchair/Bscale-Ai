'use client';

import { CloudRunLogs } from '@/src/views/CloudRunLogs';
import { Dashboard } from '@/src/views/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function CloudRunLogsPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <CloudRunLogs /> : <Dashboard />;
}
