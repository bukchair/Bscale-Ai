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
    rights: 'כל הזכויות של bscale.co.il שמורות לאשר בוקשפן (Asher Bukshpan)',
    phonePrefix: 'טלפון',
    showLocal: true,
  },
  en: {
    rights: 'All rights to bscale.co.il are reserved to Asher Bukshpan (אשר בוקשפן)',
    phonePrefix: 'Phone',
    showLocal: false,
  },
  ru: {
    rights: 'Все права на bscale.co.il принадлежат Asher Bukshpan (אשר בוקשפן)',
    phonePrefix: 'Телефон',
    showLocal: false,
  },
  pt: {
    rights: 'Todos os direitos de bscale.co.il são reservados a Asher Bukshpan (אשר בוקשפן)',
    phonePrefix: 'Telefone',
    showLocal: false,
  },
  fr: {
    rights: 'Tous les droits sur bscale.co.il sont réservés à Asher Bukshpan (אשר בוקשפן)',
    phonePrefix: 'Téléphone',
    showLocal: false,
  },
} as const;

export function SiteLegalNotice({ className, centered = false, compact = false }: SiteLegalNoticeProps) {
  const { language } = useLanguage();
  const copy = COPY[language as keyof typeof COPY] || COPY.en;

  return (
    <div
      className={cn(
        'text-gray-500 leading-relaxed',
        compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm',
        centered ? 'text-center' : '',
        className
      )}
    >
      <span>{copy.rights}</span>
      <span className="mx-2">•</span>
      <span>{copy.phonePrefix}:</span>{' '}
      {copy.showLocal ? (
        <>
          <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
            {PHONE_LOCAL}
          </a>
          <span className="mx-1">/</span>
          <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
            {PHONE_INTL}
          </a>
        </>
      ) : (
        <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:text-indigo-600 transition-colors" dir="ltr">
          {PHONE_INTL}
        </a>
      )}
    </div>
  );
}
