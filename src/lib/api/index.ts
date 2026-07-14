// lib/api/index.ts — typed fetchers
import { LatestDataSchema, VerdictSchema, GexDataSchema, AccuracySchema, type LatestData, type Verdict, type GexData, type Accuracy } from '@/lib/schemas/market';
import { ScreenerDataSchema, type ScreenerResult } from '@/lib/schemas/screener';
import { fetchGated, GateError } from './gated';

async function fetchJson<T>(url: string, schema: { parse: (data: unknown) => T }): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  const data = await res.json();
  return schema.parse(data);
}

/** Full screener behind the gate; falls back to the public 8-row teaser. */
async function screener(): Promise<ScreenerResult> {
  try {
    const data = await fetchGated('screener-data.json', ScreenerDataSchema);
    return { mode: 'full', data };
  } catch (err) {
    const gate = err instanceof GateError ? err.kind : 'unavailable';
    const need = err instanceof GateError ? err.need : undefined;
    try {
      const lite = await fetchJson('/data/screener-lite.json', ScreenerDataSchema);
      return { mode: 'lite', gate, need, data: lite };
    } catch {
      return { mode: 'lite', gate, need, data: null };
    }
  }
}

export const api = {
  latest: () => fetchJson<LatestData>('/data/latest.json', LatestDataSchema),
  verdict: () => fetchJson<Verdict>('/data/verdict.json', VerdictSchema),
  gex: () => fetchJson<GexData>('/data/gex_data.json', GexDataSchema),
  accuracy: () => fetchJson<Accuracy>('/data/accuracy.json', AccuracySchema),
  screener,
};
