// app/dashboard/dashboard-client.tsx — The Briefing (client component)
'use client';

import React, { useEffect, useState } from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { VerdictBar } from '@/components/feature/verdict/VerdictBar';
import { IndicesCard } from '@/components/feature/market/IndicesCard';
import { VixRegimeCard } from '@/components/feature/market/VixRegimeCard';
import { DayPnLCard } from '@/components/feature/market/DayPnLCard';
import { ActionQueue } from '@/components/feature/positions/ActionQueue';
import { GexDexVexCard } from '@/components/feature/options/GexDexVexCard';
import { FomcCountdown } from '@/components/feature/calendar/FomcCountdown';
import { NewsFeed } from '@/components/feature/news/NewsFeed';
import { EarningsIntelligence, ScenarioSimulator, TimeMachine } from '@/components/feature/MissedOpportunities';

function BriefingDate() {
  // Render the date only after mount — build-time HTML must match the first client render.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    );
  }, []);

  return (
    <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono)' }}>
      {today ?? ' '}
    </p>
  );
}

export function DashboardClient() {
  return (
    <div className="space-y-4">
      <header className="pt-1 pb-2">
        <BriefingDate />
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] mt-1">
          The Briefing
        </h1>
      </header>

      <DraggableBentoGrid pageId="dashboard" items={DASHBOARD_ITEMS} />
    </div>
  );
}

// Cleaner default layout (rows balanced to 12): Verdict hero / market trio
// (Indices+VIX+Portfolio, 4+4+4 — fixes the old 6+4+4=14 overflow that cascaded
// into orphan rows) / action trio / NewsFeed hero / placeholder trio demoted
// to the bottom. Each item has a stable id so a user's custom order survives.
const DASHBOARD_ITEMS: GridItem[] = [
  { id: 'verdict', span: 'hero', node: <VerdictBar /> },
  { id: 'indices', span: 'third', node: <IndicesCard /> },
  { id: 'vix', span: 'third', node: <VixRegimeCard /> },
  { id: 'portfolio', span: 'third', node: <DayPnLCard /> },
  { id: 'actions', span: 'third', node: <ActionQueue /> },
  { id: 'gex', span: 'third', node: <GexDexVexCard /> },
  { id: 'fomc', span: 'third', node: <FomcCountdown /> },
  { id: 'news', span: 'hero', node: <NewsFeed /> },
  { id: 'earnings', span: 'third', node: <EarningsIntelligence /> },
  { id: 'scenario', span: 'third', node: <ScenarioSimulator /> },
  { id: 'timemachine', span: 'third', node: <TimeMachine /> },
];
