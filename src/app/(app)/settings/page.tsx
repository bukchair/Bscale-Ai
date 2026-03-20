'use client';

import { Settings } from '@/src/pages/Settings';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function SettingsPage() {
  const userProfile = useUserProfile();
  return <Settings userProfile={userProfile} />;
}
