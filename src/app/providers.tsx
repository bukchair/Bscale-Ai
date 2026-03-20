'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/src/contexts/ThemeContext';
import { LanguageProvider } from '@/src/contexts/LanguageContext';
import { TimeProvider } from '@/src/contexts/TimeContext';
import { CurrencyProvider } from '@/src/contexts/CurrencyContext';
import { DateRangeProvider } from '@/src/contexts/DateRangeContext';
import { ConnectionsProvider } from '@/src/contexts/ConnectionsContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <TimeProvider>
          <CurrencyProvider>
            <DateRangeProvider>
              <ConnectionsProvider>
                {children}
              </ConnectionsProvider>
            </DateRangeProvider>
          </CurrencyProvider>
        </TimeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
