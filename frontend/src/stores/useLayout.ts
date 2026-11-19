import { create } from 'zustand';

export interface LayoutState {
  panelOrder: string[];
  fullscreenPanel: string | null;
  toggleFullscreen: (panelId: string) => void;
  reorderPanels: (newOrder: string[]) => void;
  resetLayout: () => void;
}

const DEFAULT_PANEL_ORDER = ['correlation', 'returns', 'ranking', 'sharpe'];
const STORAGE_KEY = 'quantlab_multi_panel_order';

function loadStoredOrder(): string[] {
  if (typeof window === 'undefined') return DEFAULT_PANEL_ORDER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 4) return parsed;
    }
  } catch {}
  return DEFAULT_PANEL_ORDER;
}

export const useLayout = create<LayoutState>((set) => ({
  panelOrder: DEFAULT_PANEL_ORDER,
  fullscreenPanel: null,

  toggleFullscreen: (panelId) => {
    set((state) => ({
      fullscreenPanel: state.fullscreenPanel === panelId ? null : panelId,
    }));
  },

  reorderPanels: (newOrder) => {
    set({ panelOrder: newOrder });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
      } catch {}
    }
  },

  resetLayout: () => {
    set({ panelOrder: DEFAULT_PANEL_ORDER, fullscreenPanel: null });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  },
}));
