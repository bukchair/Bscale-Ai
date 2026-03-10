import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
console.log('Main.tsx is running');
import App from './App';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import { ConnectionsProvider } from './contexts/ConnectionsContext';
import { ThemeProvider } from './contexts/ThemeContext';

import {ErrorBoundary} from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
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
  </ErrorBoundary>,
);
