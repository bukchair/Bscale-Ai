import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type DateRangeType = 'today' | '7days' | '30days' | 'custom';
export interface ResolvedDateRange {
  startDate: string;
  endDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const resolveDateRange = (
  dateRange: DateRangeType,
  customRange: { start: Date | null; end: Date | null }
): ResolvedDateRange => {
  const today = new Date();
  const todayFormatted = formatDate(today);

  if (dateRange === 'today') {
    return { startDate: todayFormatted, endDate: todayFormatted };
  }

  if (dateRange === '7days') {
    return { startDate: formatDate(addDays(today, -6)), endDate: todayFormatted };
  }

  if (dateRange === '30days') {
    return { startDate: formatDate(addDays(today, -29)), endDate: todayFormatted };
  }

  if (customRange.start && customRange.end) {
    const start = customRange.start <= customRange.end ? customRange.start : customRange.end;
    const end = customRange.start <= customRange.end ? customRange.end : customRange.start;
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }

  return { startDate: formatDate(addDays(today, -29)), endDate: todayFormatted };
};

export const getRangeLengthInDays = (range: ResolvedDateRange) => {
  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);
  const diff = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return Math.max(1, diff);
};

interface DateRangeContextType {
  dateRange: DateRangeType;
  setDateRange: (range: DateRangeType) => void;
  customRange: { start: Date | null; end: Date | null };
  setCustomRange: (range: { start: Date | null; end: Date | null }) => void;
  resolvedRange: ResolvedDateRange;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeType>('30days');
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const resolvedRange = useMemo(
    () => resolveDateRange(dateRange, customRange),
    [dateRange, customRange]
  );

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, customRange, setCustomRange, resolvedRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
}
