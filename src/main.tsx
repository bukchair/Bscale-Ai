import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import { ConnectionsProvider } from './contexts/ConnectionsContext';
import { ThemeProvider } from './contexts/ThemeContext';


createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LanguageProvider>
      <DateRangeProvider>
        <ConnectionsProvider>
          <App />
        </ConnectionsProvider>
      </DateRangeProvider>
    </LanguageProvider>
  </ThemeProvider>,
);
