// stores/entitlements.ts — client gate registry.
//
// The Worker's data_gate.js is the source of truth for premium data; this
// registry only drives the cosmetic FeatureGate overlay for features whose
// data is public. entitlementRank mirrors the worker's meetsTier
// (cloudflare-worker/src/session.js): trial ranks as pro.
import type { Entitlement } from '@/lib/auth/api';

export type GateTier = 'basic' | 'pro';
export type FeatureKey = 'gammaWalls' | 'nope' | 'maxPain' | 'calibration' | 'walkforward' | 'simulation';

export const FEATURES: Record<FeatureKey, { minTier: GateTier; teaser: 'blur' | 'lock' }> = {
  walkforward: { minTier: 'pro', teaser: 'lock' },
  simulation:  { minTier: 'pro', teaser: 'lock' },
  gammaWalls:  { minTier: 'pro', teaser: 'blur' },
  nope:        { minTier: 'pro', teaser: 'blur' },
  maxPain:     { minTier: 'pro', teaser: 'blur' },
  calibration: { minTier: 'pro', teaser: 'blur' },
};

export const NEED_RANK: Record<GateTier, 1 | 2> = { basic: 1, pro: 2 };

export function entitlementRank(ent: Entitlement | null | undefined): 0 | 1 | 2 {
  if (!ent?.entitled) return 0;
  if (ent.tier === 'trial' || ent.tier === 'pro') return 2;
  if (ent.tier === 'basic') return 1;
  return 0;
}