import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import type { DailyEntry, DayTemplate, TemplateDefinition } from '../types';
import { createEmptyEntry } from '../types';
import { format } from 'date-fns';
import { calculateScore, calculateSubScores, calculateScoreBreakdown } from '../engines/scoreEngine';
import { useTaskStore } from './taskStore';
import { useAnalyticsStore } from './analyticsStore';
import { STORAGE_NAMES } from '../config/identity';
import { useBiometricStore } from './biometricStore';
import { hydrateDailyEntriesFromApi, isDailyApiEnabled, saveDailyEntriesBatchToApi, saveDailyEntryToApi } from '../lib/api/dailyEntries';
import { createInitialRemoteSyncState, markRemoteSyncError, markRemoteSyncLocal, markRemoteSyncStart, markRemoteSyncSuccess, type RemoteSyncState } from './remoteSync';

export const BUILTIN_TEMPLATES: Record<string, TemplateDefinition> = {
  execution: {
    id: 'execution',
    type: 'builtin',
    name: 'EXECUTION MODE',
    systemType: 'balanced',
    structure: [
      { id: 'wake-1', type: 'wake', title: 'WAKE SYSTEM' },
      { id: 'body-1', type: 'body', title: 'BODY SYSTEM' },
      { id: 'dw-1', type: 'deep_work', title: 'DEEP WORK', dwCount: 2 },
      { id: 'prod-1', type: 'production', title: 'PRODUCTION' },
      { id: 'ref-1', type: 'reflection', title: 'REFLECTION' }
    ]
  },
  domination: {
    id: 'domination',
    type: 'builtin',
    name: 'DOMINATION MODE',
    systemType: 'domination',
    structure: [
      { id: 'wake-1', type: 'wake', title: 'WAKE SYSTEM' },
      { id: 'body-1', type: 'body', title: 'BODY SYSTEM' },
      { id: 'dw-1', type: 'deep_work', title: 'DEEP WORK', dwCount: 3 },
      { id: 'prod-1', type: 'production', title: 'PRODUCTION' },
      { id: 'ref-1', type: 'reflection', title: 'REFLECTION' }
    ]
  },
  recovery: {
    id: 'recovery',
    type: 'builtin',
    name: 'RECOVERY MODE',
    systemType: 'recovery',
    structure: [
      { id: 'wake-1', type: 'wake', title: 'WAKE SYSTEM' },
      { id: 'custom-1', type: 'custom', title: 'LIGHT WORK', customType: 'toggle' },
      { id: 'body-1', type: 'body', title: 'BODY SYSTEM' },
      { id: 'ref-1', type: 'reflection', title: 'REFLECTION' }
    ]
  }
};

export interface SystemLog {
  date: string;
  message: string;
  reason: string;
}

interface DailyState extends RemoteSyncState {
  entries: Record<string, DailyEntry>;
  customTemplates: TemplateDefinition[];
  activeTemplateId: string | null;

  // Phase 4 Autonomous Controls
  adaptationMode: 'manual' | 'assist' | 'auto';
  systemEvolutionLogs: SystemLog[];

  // Actions
  setActiveTemplate: (id: string | null) => void;
  saveCustomTemplate: (template: TemplateDefinition) => void;
  deleteCustomTemplate: (id: string) => void;
  getActiveTemplateStructure: () => DayTemplate | null;
  getActiveTemplateName: () => string;
  setAdaptationMode: (mode: 'manual' | 'assist' | 'auto') => void;
  logSystemEvolution: (log: SystemLog) => void;

  getEntry: (date: string) => DailyEntry;
  updateEntry: (date: string, updates: Partial<DailyEntry>) => void;
  completeEntry: (date: string) => void;
  recomputeAllScores: () => void;
  getAllEntries: () => DailyEntry[];
  getRecentEntries: (count: number) => DailyEntry[];
  getTodayEntry: () => DailyEntry;
  hydrateFromRemote: () => Promise<void>;
  retryRemoteSync: () => Promise<void>;
}

function pickNewerEntry(localEntry: DailyEntry | undefined, remoteEntry: DailyEntry) {
  if (!localEntry) return remoteEntry;
  return new Date(remoteEntry.updatedAt).getTime() >= new Date(localEntry.updatedAt).getTime() ? remoteEntry : localEntry;
}

function getEntriesNeedingRemoteSync(localEntries: Record<string, DailyEntry>, remoteEntries: Record<string, DailyEntry>) {
  return Object.values(localEntries)
    .filter((localEntry) => {
      const remoteEntry = remoteEntries[localEntry.date];
      if (!remoteEntry) return true;
      return new Date(localEntry.updatedAt).getTime() > new Date(remoteEntry.updatedAt).getTime();
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export const useDailyStore = create<DailyState>()(
  persist(
    (set, get) => ({
      entries: {},
      customTemplates: [],
      activeTemplateId: null,
      adaptationMode: 'assist',
      systemEvolutionLogs: [],
      ...createInitialRemoteSyncState(),

      setActiveTemplate: (id: string | null) => set({ activeTemplateId: id }),
      setAdaptationMode: (mode: 'manual' | 'assist' | 'auto') => set({ adaptationMode: mode }),
      logSystemEvolution: (log: SystemLog) => set((state: DailyState) => ({ 
         systemEvolutionLogs: [log, ...state.systemEvolutionLogs].slice(0, 50) // keep last 50 
      })),
      
      saveCustomTemplate: (template: TemplateDefinition) => set((state: DailyState) => {
        const existingIdx = state.customTemplates.findIndex(t => t.id === template.id);
        if (existingIdx >= 0) {
          const newArr = [...state.customTemplates];
          newArr[existingIdx] = template;
          return { customTemplates: newArr };
        } else {
          return { customTemplates: [...state.customTemplates, template] };
        }
      }),

      deleteCustomTemplate: (id: string) => set((state: DailyState) => ({
        customTemplates: state.customTemplates.filter((t: TemplateDefinition) => t.id !== id),
        activeTemplateId: state.activeTemplateId === id ? null : state.activeTemplateId
      })),

      getActiveTemplateStructure: () => {
        const id = get().activeTemplateId;
        if (!id) return null;
        if (BUILTIN_TEMPLATES[id]) return BUILTIN_TEMPLATES[id].structure;
        const custom = get().customTemplates.find((t: TemplateDefinition) => t.id === id);
        return custom ? custom.structure : null;
      },

      getActiveTemplateName: () => {
        const id = get().activeTemplateId;
        if (!id) return 'UNKNOWN SYSTEM';
        if (BUILTIN_TEMPLATES[id]) return BUILTIN_TEMPLATES[id].name;
        const custom = get().customTemplates.find((t: TemplateDefinition) => t.id === id);
        return custom ? custom.name : 'CUSTOM SYSTEM';
      },

      getEntry: (date: string) => {
        const existing = get().entries[date];
        if (existing) return existing;
        const struct = get().getActiveTemplateStructure() || undefined;
        const newEntry = createEmptyEntry(date, struct);
        set((state: DailyState) => ({
          entries: { ...state.entries, [date]: newEntry },
        }));
        return newEntry;
      },

      updateEntry: (date: string, updates: Partial<DailyEntry>) => {
        let nextEntry: DailyEntry | null = null;
        set((state: DailyState) => {
          const struct = state.getActiveTemplateStructure() || undefined;
          const existing = state.entries[date] || createEmptyEntry(date, struct);
          nextEntry = { ...existing, ...updates, updatedAt: new Date().toISOString() };
          return {
            entries: {
              ...state.entries,
              [date]: nextEntry,
            },
          };
        });
        if (nextEntry) {
          if (!isDailyApiEnabled()) return;
          set(markRemoteSyncStart());
          void saveDailyEntryToApi(nextEntry).catch((error) => {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to sync daily entry'));
            console.warn('Failed to sync daily entry to API', error);
          }).then(() => {
            if (!get().remoteSyncError) {
              set(markRemoteSyncSuccess());
            }
          });
        }
      },

      completeEntry: (date: string) => {
        const entry = get().entries[date];
        if (!entry) return;

        // Phase 6: Sync tasks for scoring evaluation
        const tasks = useTaskStore.getState().tasks;
        const bodyHabits = useBiometricStore.getState().habits;
        const scoreOptions = { tasks, bodyHabits };

        const { score, state: systemState } = calculateScore(entry, scoreOptions);
        const subScores = calculateSubScores(entry, scoreOptions);
        const breakdown = calculateScoreBreakdown(entry, scoreOptions);

        const completedEntry = {
          ...entry,
          ...subScores,
          averageScore: score,
          executionScore: breakdown.execution,
          conditionScore: breakdown.condition,
          integrityScore: breakdown.integrity,
          systemScore: breakdown.systemScore,
          completed: true,
          updatedAt: new Date().toISOString(),
        };

        set((s: DailyState) => ({
          entries: {
            ...s.entries,
            [date]: completedEntry,
          },
        }));

        if (!isDailyApiEnabled()) {
          return { score, state: systemState };
        }

        set(markRemoteSyncStart());
        void saveDailyEntryToApi(completedEntry).catch((error) => {
          set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to sync completed daily entry'));
          console.warn('Failed to sync completed daily entry to API', error);
        }).then(() => {
          if (!get().remoteSyncError) {
            set(markRemoteSyncSuccess());
          }
        });

        const prevEntries = get().getAllEntries();
        const prevEntry = prevEntries.find(e => e.date < date);
        const prevScore = prevEntry?.systemScore || 0;
        const delta = breakdown.systemScore - prevScore;

        // Resolve today's analytics predictions
        useAnalyticsStore.getState().resolvePrediction(date, breakdown.systemScore, delta);

        return { score, state: systemState };
      },

      recomputeAllScores: () => {
        const tasks = useTaskStore.getState().tasks;
        const bodyHabits = useBiometricStore.getState().habits;
        const scoreOptions = { tasks, bodyHabits };

        set((state: DailyState) => {
          const nextEntries = { ...state.entries };

          Object.entries(state.entries).forEach(([date, entry]) => {
            if (!entry.completed) return;

            const { score } = calculateScore(entry, scoreOptions);
            const subScores = calculateSubScores(entry, scoreOptions);
            const breakdown = calculateScoreBreakdown(entry, scoreOptions);

            nextEntries[date] = {
              ...entry,
              ...subScores,
              averageScore: score,
              executionScore: breakdown.execution,
              conditionScore: breakdown.condition,
              integrityScore: breakdown.integrity,
              systemScore: breakdown.systemScore,
            };
          });

          return { entries: nextEntries };
        });
      },

      getAllEntries: () => {
        return (Object.values(get().entries) as DailyEntry[])
          .filter(e => e.completed)
          .sort((a, b) => a.date.localeCompare(b.date));
      },

      getRecentEntries: (count: number) => {
        return get().getAllEntries().slice(-count);
      },

      getTodayEntry: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return get().getEntry(today);
      },

      hydrateFromRemote: async () => {
        set(markRemoteSyncStart());
        let remoteEntries: Record<string, DailyEntry> | null = null;
        try {
          remoteEntries = await hydrateDailyEntriesFromApi();
        } catch (error) {
          set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to hydrate daily entries'));
          console.warn('Failed to hydrate daily entries from API', error);
        }
        if (!remoteEntries) {
          if (get().remoteSyncStatus === 'syncing') {
            set(markRemoteSyncLocal());
          }
          return;
        }

        const localEntries = get().entries;
        const entriesToPush = getEntriesNeedingRemoteSync(localEntries, remoteEntries);

        set((state: DailyState) => {
          const nextEntries = { ...state.entries };
          Object.values(remoteEntries).forEach((remoteEntry) => {
            nextEntries[remoteEntry.date] = pickNewerEntry(nextEntries[remoteEntry.date], remoteEntry);
          });
          return { entries: nextEntries };
        });

        if (entriesToPush.length > 0) {
          try {
            await saveDailyEntriesBatchToApi(entriesToPush);
          } catch (error) {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to push local daily entries'));
            console.warn('Failed to push local daily entries to API', error);
            return;
          }
        }

        set(markRemoteSyncSuccess());
      },

      retryRemoteSync: async () => {
        if (!isDailyApiEnabled()) {
          set(markRemoteSyncLocal());
          return;
        }
        await get().hydrateFromRemote();
      },
    }),
    {
      name: STORAGE_NAMES.daily.current,
      storage: customStorage,
      partialize: (state) => ({
        entries: state.entries,
        customTemplates: state.customTemplates,
        activeTemplateId: state.activeTemplateId,
      }),
    }
  )
);
