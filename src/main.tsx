import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import { ConnectionsProvider } from './contexts/ConnectionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TimeProvider } from './contexts/TimeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { GoogleTagManager } from './components/GoogleTagManager';


createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LanguageProvider>
      <TimeProvider>
        <CurrencyProvider>
          <DateRangeProvider>
            <ConnectionsProvider>
              <GoogleTagManager />
              <App />
            </ConnectionsProvider>
          </DateRangeProvider>
        </CurrencyProvider>
      </TimeProvider>
    </LanguageProvider>
  </ThemeProvider>,
);
