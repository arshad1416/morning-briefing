// stores/watchlist.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  tickers: string[];
  add: (t: string) => void;
  remove: (t: string) => void;
  has: (t: string) => boolean;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      tickers: ['SPY', 'QQQ', 'IBIT', 'TLT'],
      add: (t) => set((s) => ({ tickers: [...new Set([...s.tickers, t])] })),
      remove: (t) => set((s) => ({ tickers: s.tickers.filter((x) => x !== t) })),
      has: (t) => get().tickers.includes(t),
    }),
    { name: 'mg-watchlist' }
  )
);
