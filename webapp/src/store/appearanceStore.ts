import { create } from 'zustand';
import type { Appearance } from '../types/workbook';

const STORAGE_KEY = 'financerecorder_appearance_v1';

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'light',
  font: 'body',
  fontSize: 'medium',
  colorTheme: 'wine',
  density: 'comfortable',
};

function load(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    /* ignore, fall through to defaults */
  }
  return { ...DEFAULT_APPEARANCE };
}

function persist(a: Appearance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch (e) {
    console.warn('Failed to save appearance preference', e);
  }
}

interface AppearanceState {
  appearance: Appearance;
  update: (patch: Partial<Appearance>) => void;
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  appearance: load(),

  update: (patch) => {
    const next = { ...get().appearance, ...patch };
    set({ appearance: next });
    persist(next);
  },
}));
