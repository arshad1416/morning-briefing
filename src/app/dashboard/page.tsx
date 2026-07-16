import type { Metadata } from 'next';
// app/dashboard/page.tsx — The Briefing
import { DashboardClient } from './dashboard-client';


export const metadata: Metadata = {
  title: 'Market Dashboard — GEX, Regime & AI Verdict',
  description:
    'Free daily S&P 500 dashboard: dealer gamma exposure (GEX), VIX regime, AI market conviction, news and key levels — updated every morning before the open.',
  alternates: { canonical: '/dashboard/' },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
