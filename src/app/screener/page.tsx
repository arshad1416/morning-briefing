// app/screener/page.tsx — Stock Screener (Basic tier)
import { ScreenerClient } from './screener-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Options & Stock Screener',
  description:
    'Screen S&P 500 and TSX names by RSI, volume, P/E, dividend, 52-week range and AI score — table and treemap views, refreshed daily.',
  path: '/screener/',
});

export default function ScreenerPage() {
  return <ScreenerClient />;
}
