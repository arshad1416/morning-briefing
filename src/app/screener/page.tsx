// app/screener/page.tsx — Stock Screener (Basic tier)
import { ScreenerClient } from './screener-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Stock Screener',
  description:
    'Screen S&P 500 and TSX names by RSI, volume, P/E, dividend, 52-week range and a 1–10 score — table and treemap views, rebuilt from a daily market snapshot.',
  path: '/screener/',
});

export default function ScreenerPage() {
  return <ScreenerClient />;
}
