"use client";

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

type SiteLegalNoticeProps = {
  className?: string;
  centered?: boolean;
  compact?: boolean;
};

const PHONE_LOCAL = '052-5640054';
const PHONE_INTL = '+972-52-564-0054';
const PHONE_TEL = '+972525640054';

const COPY = {
  he: {
    rights: 'כל הזכויות באתר bscale.co.il שמורות לאשר בוקשפן',
    phonePrefix: 'טלפון',
    intlPrefix: 'בינלאומי',
    showLocal: true as const,
  },
  en: {
    rights: 'All rights to bscale.co.il are reserved to Asher Bukshpan',
    phonePrefix: 'Phone',
    intlPrefix: 'International',
    showLocal: false as const,
  },
  ru: {
    rights: 'Все права на bscale.co.il принадлежат Asher Bukshpan',
    phonePrefix: 'Телефон',
    intlPrefix: 'Международный',
    showLocal: false as const,
  },
  pt: {
    rights: 'Todos os direitos de bscale.co.il são reservados a Asher Bukshpan',
    phonePrefix: 'Telefone',
    intlPrefix: 'Internacional',
    showLocal: false as const,
  },
  fr: {
    rights: 'Tous les droits sur bscale.co.il sont réservés à Asher Bukshpan',
    phonePrefix: 'Téléphone',
    intlPrefix: 'International',
    showLocal: false as const,
  },
} as const;

export function SiteLegalNotice({ className, centered = false, compact = false }: SiteLegalNoticeProps) {
  const { language } = useLanguage();
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const showIntlSecondary = copy.showLocal && !compact;

  return (
    <div
      className={cn(
        'text-gray-500 leading-relaxed flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-2',
        compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm',
        centered ? 'text-center justify-center items-center' : '',
        className
      )}
    >
      <span>{copy.rights}</span>
      <span className="hidden sm:inline">•</span>
      {copy.showLocal ? (
        <span>
          <span>{copy.phonePrefix}: </span>
          <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
            {PHONE_LOCAL}
          </a>
          {showIntlSecondary && (
            <>
              <span className="mx-1 text-gray-400">|</span>
              <span>{copy.intlPrefix}: </span>
              <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
                {PHONE_INTL}
              </a>
            </>
          )}
        </span>
      ) : (
        <span>
          <span>{copy.phonePrefix}: </span>
          <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
            {PHONE_INTL}
          </a>
        </span>
      )}
    </div>
  );
}
