import type { Metadata } from 'next';
// app/charts/page.tsx — Interactive charts (Pro tier)
import { ChartsClient } from './charts-client';


export const metadata: Metadata = {
  title: 'Interactive Charts — EMA, VWAP, RSI, ATR',
  description:
    'Candlestick charts with EMA 20/50, VWAP, RSI and ATR panes for S&P 500 and TSX tickers — daily, weekly, monthly and yearly timeframes.',
  alternates: { canonical: '/charts/' },
};

export default function ChartsPage() {
  return <ChartsClient />;
}
