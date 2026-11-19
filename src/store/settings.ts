import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedSettings } from "@/data/seed";
import type { AppTheme, ReaderPreferences } from "@/types";

interface SettingsState {
  theme: AppTheme;
  displayName: string;
  dailyGoal: number;
  reader: ReaderPreferences;
  setTheme: (theme: AppTheme) => void;
  setDisplayName: (name: string) => void;
  setDailyGoal: (minutes: number) => void;
  setReader: (patch: Partial<ReaderPreferences>) => void;
  resetSettings: () => void;
}

const defaults = () => structuredClone(seedSettings);

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults(),

      setTheme: (theme) => set({ theme }),

      setDisplayName: (displayName) =>
        set({ displayName: displayName.trim().slice(0, 40) || "Reader" }),

      setDailyGoal: (dailyGoal) =>
        set({ dailyGoal: Math.min(180, Math.max(5, dailyGoal)) }),

      setReader: (patch) =>
        set((state) => ({ reader: { ...state.reader, ...patch } })),

      resetSettings: () => set(defaults()),
    }),
    {
      name: "akshara-settings-v1",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState>;
        if (version < 2) {
          // Theme-follow is the new default reading mode: imported PDFs now
          // match the website theme until the reader theme is changed again.
          if (state.reader) {
            state.reader = {
              ...state.reader,
              theme: "follow",
            };
          }
        }
        if (version < 3 && state.reader) {
          // Pages now blend into the theme by default.
          state.reader = {
            ...state.reader,
            pdfPages: state.reader.pdfPages ?? "theme",
          };
        }
        return state as SettingsState;
      },
      partialize: (state) => ({
        theme: state.theme,
        displayName: state.displayName,
        dailyGoal: state.dailyGoal,
        reader: state.reader,
      }),
    },
  ),
);
