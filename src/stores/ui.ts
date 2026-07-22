// stores/ui.ts — theme, learning mode, sidebar state
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'dark' | 'light';
  density: 'comfortable' | 'compact';
  learningMode: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  setTheme: (t: 'dark' | 'light') => void;
  setDensity: (d: 'comfortable' | 'compact') => void;
  toggleLearningMode: () => void;
  toggleSidebar: () => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'comfortable',
      learningMode: false,
      sidebarCollapsed: false,
      commandOpen: false,
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      setDensity: (density) => {
        document.documentElement.setAttribute('data-density', density);
        set({ density });
      },
      toggleLearningMode: () => set((s) => ({ learningMode: !s.learningMode })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    { name: 'mg-ui' }
  )
);
