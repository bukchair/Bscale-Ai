import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export type DateRangeType = 'today' | '7days' | '30days' | 'custom';

export interface DateRangeBounds {
  startDate: Date;
  endDate: Date;
  dateRange: DateRangeType;
}

interface DateRangeContextType {
  dateRange: DateRangeType;
  setDateRange: (range: DateRangeType) => void;
  customRange: { start: Date | null; end: Date | null };
  setCustomRange: (range: { start: Date | null; end: Date | null }) => void;
  /** גבולות התקופה הנוכחית - לשימוש בקבלת נתונים לפי תקופה */
  bounds: DateRangeBounds;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function getDateRangeBounds(
  dateRange: DateRangeType,
  customRange: { start: Date | null; end: Date | null }
): DateRangeBounds {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();

  if (dateRange === 'custom' && customRange.start && customRange.end) {
    const start = new Date(customRange.start);
    const end = new Date(customRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, dateRange: 'custom' };
  }

  if (dateRange === 'today') {
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate, dateRange: 'today' };
  }

  if (dateRange === '7days') {
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate, dateRange: '7days' };
  }

  // default: 30days
  startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate, dateRange: '30days' };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeType>('30days');
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  const bounds = useMemo(
    () => getDateRangeBounds(dateRange, customRange),
    [dateRange, customRange.start?.getTime(), customRange.end?.getTime()]
  );

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, customRange, setCustomRange, bounds }}>
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

/** מחזיר את גבולות התקופה הנוכחית - להשתמש כשצריך לטעון נתונים לפי התקופה שבחירה */
export function useDateRangeBounds(): DateRangeBounds {
  const { bounds } = useDateRange();
  return bounds;
}
