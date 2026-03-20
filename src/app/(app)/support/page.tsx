'use client';

import { Support } from '@/src/pages/Support';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function SupportPage() {
  const userProfile = useUserProfile();
  return <Support userProfile={userProfile} />;
}
