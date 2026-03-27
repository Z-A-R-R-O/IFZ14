import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import { AnalyticsHistory } from '../types';
import { v4 as uuid } from 'uuid';
import { STORAGE_NAMES } from '../config/identity';
import { hydrateAnalyticsHistoryFromApi, isAnalyticsApiEnabled, saveAnalyticsHistoryBatchToApi, saveAnalyticsHistoryToApi } from '../lib/api/analyticsHistory';
import { createInitialRemoteSyncState, markRemoteSyncError, markRemoteSyncLocal, markRemoteSyncStart, markRemoteSyncSuccess, type RemoteSyncState } from './remoteSync';

interface AnalyticsState extends RemoteSyncState {
  history: AnalyticsHistory[];
  
  // 1. Log what the engine thinks WILL happen
  logPrediction: (insightKey: string, confidence: number, predictedImpact: number, date: string) => void;
  
  // 2. Resolve what ACTUALLY happened (run at day close)
  resolvePrediction: (date: string, actualScore: number, actualDelta: number) => void;
  
  // 3. Engine calls this to learn if it was right before
  getAdjustedConfidence: (insightKey: string, baseConfidence: number) => number;
  hydrateFromRemote: () => Promise<void>;
  retryRemoteSync: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      history: [],
      ...createInitialRemoteSyncState(),

      logPrediction: (insightKey, confidence, predictedImpact, date) => set((state) => {
        // Prevent duplicate predictions for the same insight on the same day
        const exists = state.history.find(h => h.date === date && h.insightKey === insightKey);
        if (exists) return state;

        const nextHistory = {
          id: uuid(),
          date,
          insightKey,
          confidence,
          predictedImpact
        };

        if (isAnalyticsApiEnabled()) {
          set(markRemoteSyncStart());
          void saveAnalyticsHistoryToApi(nextHistory).catch((error) => {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to sync analytics history'));
          }).then(() => {
            if (!get().remoteSyncError) {
              set(markRemoteSyncSuccess());
            }
          });
        }

        return {
          history: [...state.history, nextHistory]
        };
      }),

      resolvePrediction: (date, actualScore, actualDelta) => set((state) => {
        const updated = state.history.map(h => {
          if (h.date === date && h.actualOutcome === undefined) {
            // If the insight was a global score prediction, use absolute score, else use delta
            const actualOutcome = h.insightKey === 'DAILY_SCORE' ? actualScore : actualDelta;
            const error = Math.abs(h.predictedImpact - actualOutcome);
            return { ...h, actualOutcome, error };
          }
          return h;
        });

        if (isAnalyticsApiEnabled()) {
          const changed = updated.filter((item, index) => item !== state.history[index]);
          if (changed.length > 0) {
            set(markRemoteSyncStart());
            void saveAnalyticsHistoryBatchToApi(changed).catch((error) => {
              set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to sync analytics resolution'));
            }).then(() => {
              if (!get().remoteSyncError) {
                set(markRemoteSyncSuccess());
              }
            });
          }
        }

        return { history: updated };
      }),

      getAdjustedConfidence: (insightKey, baseConfidence) => {
        const { history } = get();
        // Find all resolved predictions for this insight
        const resolutions = history.filter(h => h.insightKey === insightKey && h.error !== undefined);
        
        if (resolutions.length === 0) return baseConfidence;

        // Apply learning loop mathematically
        let currentConf = baseConfidence;
        
        // Chronological learning
        resolutions.sort((a, b) => a.date.localeCompare(b.date)).forEach(res => {
          const error = res.error || 0;
          // error/30 normalizes a 30-point swing. Clamp at 0 to prevent negative confidence logic.
          const errorFactor = Math.max(0, 1 - (error / 30)); 
          currentConf = currentConf * 0.7 + errorFactor * 0.3;
        });

        // Clamp final output
        return Math.max(0, Math.min(1, currentConf));
      },

      hydrateFromRemote: async () => {
        set(markRemoteSyncStart());
        let remoteHistory: AnalyticsHistory[] | null = null;
        try {
          remoteHistory = await hydrateAnalyticsHistoryFromApi();
        } catch (error) {
          set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to hydrate analytics history'));
        }

        if (!remoteHistory) {
          if (get().remoteSyncStatus === 'syncing') {
            set(markRemoteSyncLocal());
          }
          return;
        }

        const localHistory = get().history;
        const merged = new Map<string, AnalyticsHistory>();
        remoteHistory.forEach((item) => merged.set(item.id, item));
        localHistory.forEach((item) => merged.set(item.id, item));
        const nextHistory = Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date));
        const localOnly = localHistory.filter((item) => !remoteHistory.some((remote) => remote.id === item.id));

        set({ history: nextHistory });

        if (localOnly.length > 0) {
          try {
            await saveAnalyticsHistoryBatchToApi(localOnly);
          } catch (error) {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to push local analytics history'));
            return;
          }
        }

        set(markRemoteSyncSuccess());
      },

      retryRemoteSync: async () => {
        if (!isAnalyticsApiEnabled()) {
          set(markRemoteSyncLocal());
          return;
        }
        await get().hydrateFromRemote();
      }
    }),
    {
      name: STORAGE_NAMES.analytics.current, // Persists predictions across reloads
      storage: customStorage,
    }
  )
);
