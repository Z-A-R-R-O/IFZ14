import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import { STORAGE_NAMES } from '../config/identity';

interface PrefsState {
  autoSave: boolean;
  animations: boolean;
  toggleAutoSave: () => void;
  toggleAnimations: () => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      autoSave: true,
      animations: true,
      toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
      toggleAnimations: () => set((s) => ({ animations: !s.animations })),
    }),
    { name: STORAGE_NAMES.prefs.current, storage: customStorage }
  )
);
