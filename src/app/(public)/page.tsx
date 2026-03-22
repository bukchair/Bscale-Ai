import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/src/lib/auth/session';
import LandingPageClient from './LandingPageClient';

export default async function LandingPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE_NAME)?.value) {
    redirect('/app');
  }
  return <LandingPageClient />;
}
