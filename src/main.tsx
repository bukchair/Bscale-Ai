import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import { ConnectionsProvider } from './contexts/ConnectionsContext';
import { ThemeProvider } from './contexts/ThemeContext';

import {ErrorBoundary} from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <DateRangeProvider>
            <ConnectionsProvider>
              <App />
            </ConnectionsProvider>
          </DateRangeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
