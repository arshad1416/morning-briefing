// app/sitemap.ts — generated at build time; replaces the old hand-written
// public/sitemap.xml (which listed 7 URLs and never updated). Archive entries
// are read from data/archive-index.json so every briefing page is discoverable.
import type { MetadataRoute } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import { getTickerCoverage } from '@/lib/seo/ticker-coverage';

const SITE = 'https://maplegamma.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...['dashboard', 'options', 'screener', 'models', 'research', 'charts', 'positions', 'predictions', 'archive'].map((r) => ({
      url: `${SITE}/${r}/`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    { url: `${SITE}/terms.html`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/privacy.html`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  let dates: string[] = [];
  try {
    const idx = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'archive-index.json'), 'utf8'),
    );
    dates = (idx.dates ?? []).filter((d: string) =>
      fs.existsSync(path.join(process.cwd(), 'data', 'archive', `${d}.json`)),
    );
  } catch {
    // no archive index at build — sitemap still covers the main routes
  }

  const archive: MetadataRoute.Sitemap = dates.map((d) => ({
    url: `${SITE}/archive/${d}/`,
    lastModified: new Date(`${d}T12:00:00-04:00`),
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  const tickers: MetadataRoute.Sitemap = getTickerCoverage().map((ticker) => ({
    url: `${SITE}/ticker/${encodeURIComponent(ticker.symbol)}/`,
    lastModified: ticker.generatedAt ? new Date(ticker.generatedAt) : now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...routes, ...tickers, ...archive];
}
