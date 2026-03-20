'use client';

import { SystemMail } from '@/src/pages/SystemMail';
import { Dashboard } from '@/src/pages/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function SystemMailPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <SystemMail /> : <Dashboard />;
}
