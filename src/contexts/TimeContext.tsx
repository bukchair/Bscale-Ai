"use client";

import React, { createContext, useContext, useMemo } from 'react';

interface TimeContextType {
  systemTimeZone: string; // Asia/Jerusalem
  userTimeZone: string;   // browser local
  formatSystemDateTime: (date: Date | string | number) => string;
  formatUserDateTime: (date: Date | string | number) => string;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

function normalizeDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  return new Date(input);
}

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<TimeContextType>(() => {
    const systemTimeZone = 'Asia/Jerusalem';
    let userTimeZone = systemTimeZone;
    try {
      userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || systemTimeZone;
    } catch {
      userTimeZone = systemTimeZone;
    }

    const formatSystemDateTime = (raw: Date | string | number) => {
      const d = normalizeDate(raw);
      try {
        return new Intl.DateTimeFormat('he-IL', {
          timeZone: systemTimeZone,
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(d);
      } catch {
        return d.toLocaleString('he-IL');
      }
    };

    const formatUserDateTime = (raw: Date | string | number) => {
      const d = normalizeDate(raw);
      try {
        return new Intl.DateTimeFormat('he-IL', {
          timeZone: userTimeZone,
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(d);
      } catch {
        return d.toLocaleString('he-IL');
      }
    };

    return {
      systemTimeZone,
      userTimeZone,
      formatSystemDateTime,
      formatUserDateTime,
    };
  }, []);

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTime() {
  const ctx = useContext(TimeContext);
  if (!ctx) {
    throw new Error('useTime must be used within TimeProvider');
  }
  return ctx;
}

