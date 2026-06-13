// stores/entitlements.ts — gating brain
import { create } from 'zustand';

type Tier = 'free' | 'pro';
export type FeatureKey = 'gammaWalls' | 'calibration' | 'scenarioSim' | 'congressTrades' | 'briefingExport';

export const FEATURES: Record<FeatureKey, { minTier: Tier; teaser: 'blur' | 'lock' | 'cta' }> = {
  gammaWalls:     { minTier: 'pro', teaser: 'blur' },
  calibration:    { minTier: 'pro', teaser: 'blur' },
  scenarioSim:    { minTier: 'pro', teaser: 'lock' },
  congressTrades: { minTier: 'pro', teaser: 'blur' },
  briefingExport: { minTier: 'pro', teaser: 'cta' },
};

const tierRank: Record<Tier, number> = { free: 0, pro: 1 };

interface EntState {
  tier: Tier;
  gatingEnabled: boolean;
  can: (feature: FeatureKey) => boolean;
}

export const useEntitlements = create<EntState>()((set, get) => ({
  tier: 'pro',
  gatingEnabled: false,
  can(feature: FeatureKey) {
    const { gatingEnabled, tier } = get();
    if (!gatingEnabled) return true;
    return tierRank[tier] >= tierRank[FEATURES[feature].minTier];
  },
}));
