// components/feature/news/NewsFeed.tsx — top headlines
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader } from '@/components/primitives';

export function NewsFeed() {
  const { data } = useQuery(latestQuery());

  const headlines = data?.market_news.headlines ?? [];

  const sentimentColor = (s: string) =>
    s === 'bullish' ? 'var(--color-bull)' : s === 'bearish' ? 'var(--color-bear)' : 'var(--color-neutral)';

  // The dot was aria-hidden with no text and no legend anywhere, so its meaning
  // reached neither screen readers nor beginners.
  const sentimentLabel = (s: string) =>
    s === 'bullish'
      ? 'Reads as good for prices.'
      : s === 'bearish'
      ? 'Reads as bad for prices.'
      : 'Reads as neutral for prices.';

  return (
    <Surface span="half">
      <SurfaceHeader title="News Feed" />
      <div className="p-4 space-y-3">
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          The dot shows how each story reads for share prices: green good, red bad, grey neutral.
        </p>
        {headlines.slice(0, 8).map((h, i) => (
          <a
            key={i}
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors group"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: sentimentColor(h.sentiment) }}
                aria-hidden="true"
              />
              <span className="sr-only">{sentimentLabel(h.sentiment)} </span>
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-fg)] line-clamp-2">
                  {h.title}
                </p>
                <span className="text-xs text-[var(--color-text-tertiary)]">{h.source}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </Surface>
  );
}
