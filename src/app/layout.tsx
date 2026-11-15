import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientLayout } from '@/components/ClientLayout';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
});

export const metadata: Metadata = {
  title: 'PrintPRO',
  description: 'Fast, simple billing software for Xerox and stationery shops',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PrintPRO',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} bg-background text-on-surface min-h-screen flex flex-col antialiased selection:bg-secondary-fixed-dim`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
