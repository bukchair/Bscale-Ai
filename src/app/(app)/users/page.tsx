'use client';

import { Users } from '@/src/pages/Users';
import { Dashboard } from '@/src/pages/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function UsersPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <Users /> : <Dashboard />;
}
