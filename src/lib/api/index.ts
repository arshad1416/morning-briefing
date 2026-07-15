// lib/api/index.ts — typed fetchers
import { LatestDataSchema, VerdictSchema, GexDataSchema, NopeDetailSchema, AccuracySchema, PredictionEngineSchema, type LatestData, type Verdict, type GexData, type NopeDetail, type Accuracy, type PredictionEngine } from '@/lib/schemas/market';
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
  // Free users receive the aggregate GEX summary. Strike-level gamma walls,
  // OI and positioning live in the Pro-gated R2 detail file.
  gex: () => fetchJson<GexData>('/data/maplegamma-data.json', GexDataSchema),
  gexDetail: () => fetchGated<GexData>('gex-detail.json', GexDataSchema),
  nopeDetail: () => fetchGated<NopeDetail>('nope-detail.json', NopeDetailSchema),
  // accuracy.json is Pro-gated R2 data (see data_gate.js) — it never exists
  // under public /data/ on Pages, so it must go through the Worker gate.
  accuracy: () => fetchGated<Accuracy>('accuracy.json', AccuracySchema),
  // Pro-gated: the V-series backtest corpus + live-trading summary.
  predictionEngine: () => fetchGated<PredictionEngine>('prediction-engine.json', PredictionEngineSchema),
  screener,
};
