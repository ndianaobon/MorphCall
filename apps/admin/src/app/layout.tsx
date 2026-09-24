import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminProviders } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MorphCall Admin', template: '%s · MorphCall Admin' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
