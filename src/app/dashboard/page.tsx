import type { Metadata } from 'next';
// app/dashboard/page.tsx — The Briefing
import { DashboardClient } from './dashboard-client';


// The old title/description promised "dealer gamma exposure" and "key levels".
// Neither is what this page shows: the GEX headline here is the GROSS figure
// (calls and puts added together, never netted), which is a different quantity
// from the signed dealer number on /options, and no support/resistance levels
// appear on /dashboard at all. Kept the GEX and VIX keywords, dropped the two
// claims the page cannot back, and said in plain words what each number is.
export const metadata: Metadata = {
  title: 'Market Dashboard — GEX, VIX & Today’s Market Score',
  description:
    'Free daily S&P 500 dashboard: how much options hedging is in play (gamma exposure), where the VIX fear gauge sits, a 0–10 score for how the day is shaping up, and the news moving markets — updated every morning before the open.',
  alternates: { canonical: '/dashboard/' },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
