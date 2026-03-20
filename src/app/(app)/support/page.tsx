'use client';

import { Support } from '@/src/views/Support';
import { useUserProfile } from '@/src/contexts/UserProfileContext';

export default function SupportPage() {
  const userProfile = useUserProfile();
  return <Support userProfile={userProfile} />;
}
