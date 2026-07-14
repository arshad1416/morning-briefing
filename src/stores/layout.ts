// stores/layout.ts — per-page card order (user-rearrangeable dashboards).
//
// Mirrors the existing mg-ui / mg-watchlist zustand+persist pattern. Persists
// to localStorage today (per-device); the shape (order keyed by pageId) is
// exactly what an account-synced D1 backend would store, so adding cross-device
// sync later is a store-internals change, not a caller change.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
  /** pageId -> ordered card-id array (a saved custom order). */
  order: Record<string, string[]>;
  /** Whether the user is in "edit layout" mode (drag handles visible). */
  editing: boolean;
  setOrder: (pageId: string, ids: string[]) => void;
  reset: (pageId: string) => void;
  toggleEditing: () => void;
  setEditing: (v: boolean) => void;
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      order: {},
      editing: false,
      setOrder: (pageId, ids) => set((s) => ({ order: { ...s.order, [pageId]: ids } })),
      reset: (pageId) =>
        set((s) => {
          const next = { ...s.order };
          delete next[pageId];
          return { order: next };
        }),
      toggleEditing: () => set((s) => ({ editing: !s.editing })),
      setEditing: (editing) => set({ editing }),
    }),
    {
      name: 'mg-layout',
      // never persist the transient editing flag
      partialize: (s) => ({ order: s.order }),
    }
  )
);

/**
 * Reconcile a saved order against the current default card-id set:
 *  - keep saved positions for ids that still exist,
 *  - append NEW default ids (added since the user last customized) at the end,
 *  - drop saved ids that no longer exist.
 */
export function reconcileOrder(saved: string[] | undefined, defaults: string[]): string[] {
  if (!saved || saved.length === 0) return defaults;
  const defaultSet = new Set(defaults);
  const kept = saved.filter((id) => defaultSet.has(id));
  const keptSet = new Set(kept);
  const added = defaults.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}
