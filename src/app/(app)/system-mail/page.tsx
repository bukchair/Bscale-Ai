'use client';

import { SystemMail } from '@/src/views/SystemMail';
import { Dashboard } from '@/src/views/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function SystemMailPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <SystemMail /> : <Dashboard />;
}
