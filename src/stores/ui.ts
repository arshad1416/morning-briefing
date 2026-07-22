// stores/ui.ts — theme, learning mode, sidebar state
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'dark' | 'light';
  learningMode: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  setTheme: (t: 'dark' | 'light') => void;
  toggleLearningMode: () => void;
  toggleSidebar: () => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      // On by default: a first-time visitor is the person who most needs the
      // plain-English tooltips, and they will never find the toggle on their
      // own. Experienced users switch it off once and `persist` remembers it.
      learningMode: true,
      sidebarCollapsed: false,
      commandOpen: false,
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      toggleLearningMode: () => set((s) => ({ learningMode: !s.learningMode })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    { name: 'mg-ui' }
  )
);
