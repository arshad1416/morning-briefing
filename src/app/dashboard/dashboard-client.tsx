// app/dashboard/dashboard-client.tsx — The Briefing (client component)
'use client';

import React from 'react';
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

export function DashboardClient() {
  return (
    <div className="space-y-4">
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
