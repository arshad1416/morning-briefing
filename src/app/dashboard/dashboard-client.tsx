// app/dashboard/dashboard-client.tsx — The Briefing (client component)
'use client';

import React, { useEffect, useState } from 'react';
import { BentoGrid, BentoTile } from '@/components/layout/BentoGrid';
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

      <BentoGrid>
        {/* A1: Verdict hero */}
        <BentoTile span="hero">
          <VerdictBar />
        </BentoTile>

        {/* A2: Market context row */}
        <BentoTile span="half">
          <IndicesCard />
        </BentoTile>
        <BentoTile span="third">
          <VixRegimeCard />
        </BentoTile>
        <BentoTile span="third">
          <DayPnLCard />
        </BentoTile>

        {/* A2: Action + Options + Calendar row */}
        <BentoTile span="third">
          <ActionQueue />
        </BentoTile>
        <BentoTile span="third">
          <GexDexVexCard />
        </BentoTile>
        <BentoTile span="third">
          <FomcCountdown />
        </BentoTile>

        {/* A2: News + Missed opportunities */}
        <BentoTile span="half">
          <NewsFeed />
        </BentoTile>
        <BentoTile span="half">
          <EarningsIntelligence />
        </BentoTile>

        {/* Missed opportunity placeholders */}
        <BentoTile span="half">
          <ScenarioSimulator />
        </BentoTile>
        <BentoTile span="half">
          <TimeMachine />
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
