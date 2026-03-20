'use client';

import { Leads } from '@/src/views/Leads';
import { Dashboard } from '@/src/views/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function LeadsPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <Leads /> : <Dashboard />;
}
