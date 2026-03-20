'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Auth } from '@/src/pages/Auth';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  return <Auth onLogin={() => router.push('/app')} initialMode={mode} />;
}
