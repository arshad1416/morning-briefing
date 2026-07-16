import type { Metadata } from 'next';
// app/positions/page.tsx — Positions page (placeholder)
import { PositionsClient } from './positions-client';


export const metadata: Metadata = {
  title: 'Simulated Portfolio & Trade Journal',
  description:
    'Paper-trading transparency: a simulated multi-asset portfolio with open positions, options trades and a full journal — every trade tracked and scored.',
  alternates: { canonical: '/positions/' },
};

export default function PositionsPage() {
  return <PositionsClient />;
}
