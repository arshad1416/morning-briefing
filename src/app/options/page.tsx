import type { Metadata } from 'next';
// app/options/page.tsx — Options page
import { OptionsClient } from './options-client';


export const metadata: Metadata = {
  title: 'Gamma Exposure (GEX) & Dealer Positioning',
  description:
    'SPX dealer gamma by strike: GEX, DEX and VEX, zero-gamma flip level, max pain, vanna and charm — institutional options positioning, updated daily.',
  alternates: { canonical: '/options/' },
};

export default function OptionsPage() {
  return <OptionsClient />;
}
