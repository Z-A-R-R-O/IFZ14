import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import { STORAGE_NAMES } from '../config/identity';

interface SuggestionEntry {
  text: string;
  count: number;
}

interface SuggestionStore {
  suggestions: Record<string, SuggestionEntry[]>;
  addSuggestion: (category: string, text: string) => void;
  getSuggestions: (category: string, query: string) => string[];
}

export const useSuggestionStore = create<SuggestionStore>()(
  persist(
    (set, get) => ({
      suggestions: {},

      addSuggestion: (category: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        set((state) => {
          const existing = state.suggestions[category] || [];
          const idx = existing.findIndex(
            (s) => s.text.toLowerCase() === trimmed.toLowerCase()
          );

          let updated: SuggestionEntry[];
          if (idx >= 0) {
            updated = [...existing];
            updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
          } else {
            updated = [...existing, { text: trimmed, count: 1 }];
          }

          // Sort by usage frequency (most used first)
          updated.sort((a, b) => b.count - a.count);

          return {
            suggestions: { ...state.suggestions, [category]: updated },
          };
        });
      },

      getSuggestions: (category: string, query: string) => {
        const entries = get().suggestions[category] || [];
        const q = query.toLowerCase().trim();
        if (!q) return entries.map((e) => e.text);
        return entries
          .filter((e) => e.text.toLowerCase().includes(q))
          .map((e) => e.text);
      },
    }),
    {
      name: STORAGE_NAMES.suggestions.current,
      storage: customStorage,
      partialize: (state) => ({ suggestions: state.suggestions }),
    }
  )
);
