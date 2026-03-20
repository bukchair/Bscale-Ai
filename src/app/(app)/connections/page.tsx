'use client';

import { Integrations } from '@/src/pages/Integrations';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function ConnectionsPage() {
  const userProfile = useUserProfile();
  return <Integrations userProfile={userProfile} />;
}
