// app/options/page.tsx — Options page
import { OptionsClient } from './options-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Gamma Exposure (GEX) & Dealer Positioning',
  description:
    'SPX dealer gamma by strike: GEX, DEX and VEX, zero-gamma flip level, max pain, vanna and charm — institutional options positioning, updated daily.',
  path: '/options/',
});

export default function OptionsPage() {
  return <OptionsClient />;
}
