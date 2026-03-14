'use client';

import App from '@/src/App';
import { LanguageProvider } from '@/src/contexts/LanguageContext';
import { DateRangeProvider } from '@/src/contexts/DateRangeContext';
import { ConnectionsProvider } from '@/src/contexts/ConnectionsContext';
import { ThemeProvider } from '@/src/contexts/ThemeContext';
import { TimeProvider } from '@/src/contexts/TimeContext';
import { CurrencyProvider } from '@/src/contexts/CurrencyContext';

export function LegacyAppRoot() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <TimeProvider>
          <CurrencyProvider>
            <DateRangeProvider>
              <ConnectionsProvider>
                <App />
              </ConnectionsProvider>
            </DateRangeProvider>
          </CurrencyProvider>
        </TimeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
