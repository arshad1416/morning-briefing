import type { Metadata } from 'next';
// app/screener/page.tsx — Stock Screener (Basic tier)
import { ScreenerClient } from './screener-client';


export const metadata: Metadata = {
  title: 'Options & Stock Screener',
  description:
    'Screen S&P 500 and TSX names by RSI, volume, P/E, dividend, 52-week range and AI score — table and treemap views, refreshed daily.',
  alternates: { canonical: '/screener/' },
};

export default function ScreenerPage() {
  return <ScreenerClient />;
}
