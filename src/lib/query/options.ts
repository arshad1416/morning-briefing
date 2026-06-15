// lib/query/options.ts — TanStack Query options
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './keys';
import { POLL } from './policy';

export const latestQuery = () =>
  queryOptions({
    queryKey: qk.latest(),
    queryFn: () => api.latest(),
    staleTime: POLL.market.stale,
  });

export const verdictQuery = () =>
  queryOptions({
    queryKey: qk.verdict(),
    queryFn: () => api.verdict(),
    staleTime: POLL.verdict.stale,
  });

export const gexQuery = () =>
  queryOptions({
    queryKey: qk.gex(),
    queryFn: () => api.gex(),
    staleTime: POLL.options.stale,
  });

export const accuracyQuery = () =>
  queryOptions({
    queryKey: qk.accuracy(),
    queryFn: () => api.accuracy(),
    staleTime: POLL.backtest.stale,
  });
