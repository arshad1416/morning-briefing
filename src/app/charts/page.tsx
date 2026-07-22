import type { Metadata } from 'next';
// app/charts/page.tsx — Interactive charts (Pro tier)
import { ChartsClient } from './charts-client';


export const metadata: Metadata = {
  title: 'Interactive Charts — EMA, VWAP, RSI, ATR',
  description:
    'Candlestick charts with EMA 20/50, VWAP, RSI and ATR panes for 60 widely traded US stocks and ETFs — choose daily, weekly, monthly or yearly price bars.',
  alternates: { canonical: '/charts/' },
};

export default function ChartsPage() {
  return <ChartsClient />;
}
