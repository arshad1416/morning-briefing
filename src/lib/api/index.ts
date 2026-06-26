// lib/api/index.ts — typed fetchers
import { LatestDataSchema, VerdictSchema, GexDataSchema, AccuracySchema, type LatestData, type Verdict, type GexData, type Accuracy } from '@/lib/schemas/market';

async function fetchJson<T>(url: string, schema: { parse: (data: unknown) => T }): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  const data = await res.json();
  return schema.parse(data);
}

export const api = {
  latest: () => fetchJson<LatestData>('/data/latest.json', LatestDataSchema),
  verdict: () => fetchJson<Verdict>('/data/verdict.json', VerdictSchema),
  gex: () => fetchJson<GexData>('/data/gex_data.json', GexDataSchema),
  accuracy: () => fetchJson<Accuracy>('/data/accuracy.json', AccuracySchema),
};
