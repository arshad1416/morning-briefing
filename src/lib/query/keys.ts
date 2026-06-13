// lib/query/keys.ts — query key factory
export const qk = {
  latest: () => ['latest'] as const,
  verdict: () => ['verdict'] as const,
  gex: () => ['gex'] as const,
  accuracy: () => ['accuracy'] as const,
};
