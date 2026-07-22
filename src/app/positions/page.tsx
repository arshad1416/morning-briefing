// app/positions/page.tsx — Positions page (placeholder)
import { PositionsClient } from './positions-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Simulated Portfolio & Trade Journal',
  description:
    'Paper-trading transparency: a simulated multi-asset portfolio with open positions, options trades and a full journal — every trade tracked and scored.',
  path: '/positions/',
});

export default function PositionsPage() {
  return <PositionsClient />;
}
