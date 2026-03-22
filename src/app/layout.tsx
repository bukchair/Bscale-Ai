import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Providers } from './providers';
import '../index.css';

export const metadata: Metadata = {
  verification: {
    google: 'ZERrQRwr8WjQaWWTfKF1eW4ZEX4OiZwcKnOkVqhVJVE',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BScale AI',
  },
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#4f46e5" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className="bg-slate-50 text-slate-900">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-1TMNPV7WM0" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-1TMNPV7WM0');
        `}</Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
