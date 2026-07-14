// lib/api/gated.ts — fetcher for premium JSON behind the Worker data gate.
//
// Premium files live ONLY in a private R2 bucket and are served through
// /api/data/:file after a session + entitlement + tier check (see
// cloudflare-worker/src/data_gate.js). Public files stay on Pages under
// /data/. This mirrors the legacy SPA's Utils._PRIVATE_RE rewrite.
//
// The server is the source of truth for gating — the UI just reflects the
// 401/403 it gets back.

export type GateKind = 'signin' | 'upgrade' | 'unavailable';

export class GateError extends Error {
  kind: GateKind;
  need?: 'basic' | 'pro';

  constructor(kind: GateKind, need?: 'basic' | 'pro') {
    super(`gated:${kind}`);
    this.kind = kind;
    this.need = need;
  }
}

export async function fetchGated<T>(
  file: string,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/data/${file}`, { credentials: 'include' });
  } catch {
    throw new GateError('unavailable');
  }
  if (res.status === 401) throw new GateError('signin');
  if (res.status === 403) {
    let need: 'basic' | 'pro' | undefined;
    try {
      const body = (await res.json()) as { need?: 'basic' | 'pro' };
      need = body.need;
    } catch {}
    throw new GateError('upgrade', need);
  }
  if (!res.ok) throw new GateError('unavailable');
  const data = await res.json();
  return schema.parse(data);
}
