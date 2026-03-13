import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CurrencyCode = string;

export interface CurrencyOption {
  code: CurrencyCode;
  label: string;
  symbol: string;
}

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  symbol: string;
  format: (amount: number) => string;
  availableCurrencies: CurrencyOption[];
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = 'bscale_currency';

const FALLBACK_CURRENCY_CODES: CurrencyCode[] = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD',
  'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP',
  'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK',
  'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD',
  'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
];

const PRIORITY_CODES: CurrencyCode[] = [
  'ILS',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'JPY',
  'CHF',
  'CNY',
  'INR',
  'BRL',
  'MXN',
  'RUB',
  'AED',
  'SAR',
];

const getCurrencySymbol = (code: CurrencyCode): string => {
  try {
    const formatted = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const symbol = formatted.find((part) => part.type === 'currency')?.value;
    if (symbol && symbol.trim().length > 0) return symbol;
  } catch {
    // ignore
  }
  return code;
};

const getCurrencyDisplayName = (code: CurrencyCode): string => {
  try {
    const DisplayNamesCtor = (Intl as unknown as {
      DisplayNames?: new (
        locales?: string | string[],
        options?: { type: 'currency' }
      ) => { of: (value: string) => string | undefined };
    }).DisplayNames;
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
    if (DisplayNamesCtor) {
      const names = new DisplayNamesCtor([locale, 'en'], { type: 'currency' });
      return names.of(code) || code;
    }
  } catch {
    // ignore
  }
  return code;
};

const buildAvailableCurrencies = (): CurrencyOption[] => {
  const supportedValuesOf = (Intl as unknown as {
    supportedValuesOf?: (key: 'currency') => string[];
  }).supportedValuesOf;
  const intlCodes = supportedValuesOf ? supportedValuesOf('currency') : [];
  const rawCodes = intlCodes.length ? intlCodes : FALLBACK_CURRENCY_CODES;
  const uniqueCodes = Array.from(new Set(rawCodes.map((code) => code.toUpperCase())));
  const options = uniqueCodes.map((code) => ({
    code,
    label: getCurrencyDisplayName(code),
    symbol: getCurrencySymbol(code),
  }));

  const priority = new Set(PRIORITY_CODES);
  return options.sort((a, b) => {
    const aPriority = PRIORITY_CODES.indexOf(a.code);
    const bPriority = PRIORITY_CODES.indexOf(b.code);
    if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
    if (aPriority >= 0) return -1;
    if (bPriority >= 0) return 1;
    if (priority.has(a.code) && !priority.has(b.code)) return -1;
    if (!priority.has(a.code) && priority.has(b.code)) return 1;
    return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
  });
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const availableCurrencies = useMemo(() => buildAvailableCurrencies(), []);
  const [currency, setCurrencyState] = useState<CurrencyCode>('ILS');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (saved && availableCurrencies.some((option) => option.code === saved)) {
        setCurrencyState(saved);
      }
    } catch {
      // ignore
    }
  }, [availableCurrencies]);

  const setCurrency = (code: CurrencyCode) => {
    if (!availableCurrencies.some((option) => option.code === code)) return;
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  };

  const currentOption = useMemo(
    () => availableCurrencies.find((option) => option.code === currency),
    [availableCurrencies, currency]
  );

  const format = (amount: number) => {
    try {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currentOption?.symbol || currency}${amount.toLocaleString()}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        symbol: currentOption?.symbol || currency,
        format,
        availableCurrencies,
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

