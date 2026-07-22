import type { Metadata } from 'next';
// app/options/page.tsx — Options page
import { OptionsClient } from './options-client';


export const metadata: Metadata = {
  // Ticker corrected SPX → SPY: GexDataSchema emits ticker 'SPY' and every price
  // on the page is SPY-scale (spot ~748, strikes 700–800), so the old title and
  // description advertised an index this page never shows.
  title: 'Options Dealer Positioning — Gamma Exposure (GEX) in Plain English',
  // "Banks" corrected to "market makers": SPY options are made overwhelmingly by
  // non-bank proprietary firms, and the Dealer Positioning card on this page
  // defines dealers that way. This string is the search/social snippet, so it is
  // the one sentence that must not contradict the page.
  description:
    'Where the market makers who sold SPY options have to hedge, price level by price level: how much hedging is in play (GEX), which way the options lean (DEX), how much rides on volatility (VEX), the gamma flip level where hedging turns from steadying the market to amplifying it, plus max pain, vanna and charm. Updated daily.',
  alternates: { canonical: '/options/' },
};

export default function OptionsPage() {
  return <OptionsClient />;
}
