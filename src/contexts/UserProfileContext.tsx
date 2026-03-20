'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type UserProfile = {
  role?: string;
  subscriptionStatus?: string;
  uid?: string;
  name?: string;
  email?: string;
} | null;

const UserProfileContext = createContext<UserProfile>(null);

export function UserProfileProvider({
  value,
  children,
}: {
  value: UserProfile;
  children: ReactNode;
}) {
  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export const useUserProfile = () => useContext(UserProfileContext);
