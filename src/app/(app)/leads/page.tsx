'use client';

import { Leads } from '@/src/pages/Leads';
import { Dashboard } from '@/src/pages/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function LeadsPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <Leads /> : <Dashboard />;
}
