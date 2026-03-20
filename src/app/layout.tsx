import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '../index.css';

export const metadata: Metadata = {
  verification: {
    google: 'ZERrQRwr8WjQaWWTfKF1eW4ZEX4OiZwcKnOkVqhVJVE',
  },
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
