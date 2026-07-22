// app/charts/page.tsx — Interactive charts (Pro tier)
import { ChartsClient } from './charts-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Interactive Charts — EMA, VWAP, RSI, ATR',
  description:
    'Candlestick charts with EMA 20/50, VWAP, RSI and ATR panes for S&P 500 and TSX tickers — daily, weekly, monthly and yearly timeframes.',
  path: '/charts/',
});

export default function ChartsPage() {
  return <ChartsClient />;
}
