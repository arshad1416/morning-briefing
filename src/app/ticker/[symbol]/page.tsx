import type { Metadata } from 'next';
import { TickerClient } from '../ticker-client';
import { getTickerCoverage } from '@/lib/seo/ticker-coverage';

type PageProps = { params: Promise<{ symbol: string }> };

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getTickerCoverage().map(({ symbol }) => ({ symbol }));
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  const ticker = getTickerCoverage().find((entry) => entry.symbol === symbol);
  const name = ticker?.name || symbol;
  const description = `${name} (${symbol}) share price, chart signals such as RSI and moving averages, company fundamentals, recent SEC filings and the MapleGamma screening score.`;
  return {
    title: `${symbol} — ${name}`,
    description,
    alternates: { canonical: `/ticker/${encodeURIComponent(symbol)}/` },
    openGraph: {
      type: 'article',
      url: `/ticker/${encodeURIComponent(symbol)}/`,
      title: `${symbol} — ${name}`,
      description,
    },
  };
}

export default async function StaticTickerPage({ params }: PageProps) {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  return <TickerClient initialTicker={symbol} />;
}
