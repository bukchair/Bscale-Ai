import React, { createContext, useContext, useEffect, useState } from 'react';

export type CurrencyCode = 'ILS' | 'USD' | 'EUR';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  symbol: string;
  format: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = 'bscale_currency';

const currencyToIntlCode: Record<CurrencyCode, string> = {
  ILS: 'ILS',
  USD: 'USD',
  EUR: 'EUR',
};

const currencySymbol: Record<CurrencyCode, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('ILS');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (saved && (saved === 'ILS' || saved === 'USD' || saved === 'EUR')) {
        setCurrencyState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  };

  const format = (amount: number) => {
    const intlCode = currencyToIntlCode[currency];
    try {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: intlCode,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      // Fallback if Intl fails
      return `${currencySymbol[currency]}${amount.toLocaleString()}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        symbol: currencySymbol[currency],
        format,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}

