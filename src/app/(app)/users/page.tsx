'use client';

import { Users } from '@/src/views/Users';
import { Dashboard } from '@/src/views/Dashboard';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function UsersPage() {
  const userProfile = useUserProfile();
  return userProfile?.role === 'admin' ? <Users /> : <Dashboard />;
}
