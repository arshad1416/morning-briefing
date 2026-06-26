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
      learningMode: false,
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
