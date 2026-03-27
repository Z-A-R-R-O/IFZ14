import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import type { Goal, GoalTargetType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_NAMES } from '../config/identity';
import { deleteGoalFromApi, hydrateGoalsFromApi, isGoalApiEnabled, saveGoalsBatchToApi } from '../lib/api/goals';
import { createInitialRemoteSyncState, markRemoteSyncError, markRemoteSyncLocal, markRemoteSyncStart, markRemoteSyncSuccess, type RemoteSyncState } from './remoteSync';

/**
 * Goal Store — MINIMAL storage.
 *
 * Rules:
 *  - Store only truth data (id, title, targetType, targetValue, linkedTaskIds, deadline)
 *  - NEVER store derived values (progress, risk, contribution)
 *  - All intelligence lives in goalEngine.ts
 */

export interface CreateGoalData {
  title: string;
  targetType: GoalTargetType;
  targetValue: number;
  linkedTaskIds?: string[];
  trackDeepWork?: boolean;
  deadline?: string;
}

interface GoalStore extends RemoteSyncState {
  goals: Goal[];

  // CRUD
  createGoal: (data: CreateGoalData) => void;
  deleteGoal: (id: string) => void;

  // Linking
  linkTask: (goalId: string, taskId: string) => void;
  unlinkTask: (goalId: string, taskId: string) => void;

  // Update
  updateGoal: (id: string, updates: Partial<Pick<Goal, 'title' | 'targetValue' | 'deadline' | 'trackDeepWork' | 'milestoneCompleted'>>) => void;
  hydrateFromRemote: () => Promise<void>;
  retryRemoteSync: () => Promise<void>;
}

function getGoalUpdatedAt(goal: Goal) {
  return new Date(goal.updatedAt || goal.createdAt).getTime();
}

function mergeGoals(localGoals: Goal[], remoteGoals: Goal[]) {
  const merged = new Map<string, Goal>();

  for (const goal of remoteGoals) {
    merged.set(goal.id, goal);
  }

  for (const localGoal of localGoals) {
    const remoteGoal = merged.get(localGoal.id);
    if (!remoteGoal || getGoalUpdatedAt(localGoal) >= getGoalUpdatedAt(remoteGoal)) {
      merged.set(localGoal.id, localGoal);
    }
  }

  return Array.from(merged.values()).sort((left, right) => getGoalUpdatedAt(right) - getGoalUpdatedAt(left));
}

function getGoalsNeedingRemoteSync(localGoals: Goal[], remoteGoals: Goal[]) {
  const remoteGoalMap = new Map(remoteGoals.map((goal) => [goal.id, goal]));
  return localGoals.filter((localGoal) => {
    const remoteGoal = remoteGoalMap.get(localGoal.id);
    if (!remoteGoal) return true;
    return getGoalUpdatedAt(localGoal) > getGoalUpdatedAt(remoteGoal);
  });
}

function syncGoalMutation(
  get: () => GoalStore,
  set: (partial: Partial<GoalStore>) => void,
  goalOrGoals: Goal | Goal[] | null,
  fallbackMessage: string
) {
  if (!goalOrGoals || !isGoalApiEnabled()) return;

  const goals = Array.isArray(goalOrGoals) ? goalOrGoals : [goalOrGoals];
  set(markRemoteSyncStart());

  void saveGoalsBatchToApi(goals).catch((error) => {
    set(markRemoteSyncError(error instanceof Error ? error.message : fallbackMessage));
  }).then(() => {
    if (!get().remoteSyncError) {
      set(markRemoteSyncSuccess());
    }
  });
}

export const useGoalStore = create<GoalStore>()(
  persist(
    (set, get) => ({
      goals: [],
      ...createInitialRemoteSyncState(),

      createGoal: (data: CreateGoalData) => {
        const now = new Date().toISOString();
        const goal: Goal = {
          id: uuidv4(),
          title: data.title,
          targetType: data.targetType,
          targetValue: data.targetValue,
          linkedTaskIds: data.linkedTaskIds || [],
          trackDeepWork: data.trackDeepWork,
          deadline: data.deadline,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ goals: [...state.goals, goal] }));
        syncGoalMutation(get, set, goal, 'Failed to sync goal');
      },

      deleteGoal: (id: string) => {
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
        if (isGoalApiEnabled()) {
          set(markRemoteSyncStart());
          void deleteGoalFromApi(id).catch((error) => {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to delete goal remotely'));
          }).then(() => {
            if (!get().remoteSyncError) {
              set(markRemoteSyncSuccess());
            }
          });
        }
      },

      linkTask: (goalId: string, taskId: string) => {
        let nextGoal: Goal | null = null;
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId && !g.linkedTaskIds.includes(taskId)
              ? (nextGoal = { ...g, linkedTaskIds: [...g.linkedTaskIds, taskId], updatedAt: new Date().toISOString() })
              : g
          ),
        }));
        syncGoalMutation(get, set, nextGoal, 'Failed to sync goal link');
      },

      unlinkTask: (goalId: string, taskId: string) => {
        let nextGoal: Goal | null = null;
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? (nextGoal = { ...g, linkedTaskIds: g.linkedTaskIds.filter((id) => id !== taskId), updatedAt: new Date().toISOString() })
              : g
          ),
        }));
        syncGoalMutation(get, set, nextGoal, 'Failed to sync goal unlink');
      },

      updateGoal: (id: string, updates) => {
        let nextGoal: Goal | null = null;
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? (nextGoal = { ...g, ...updates, updatedAt: new Date().toISOString() }) : g
          ),
        }));
        syncGoalMutation(get, set, nextGoal, 'Failed to sync goal');
      },

      hydrateFromRemote: async () => {
        set(markRemoteSyncStart());
        let remoteGoals: Goal[] | null = null;
        try {
          remoteGoals = await hydrateGoalsFromApi();
        } catch (error) {
          set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to hydrate goals'));
        }

        if (!remoteGoals) {
          if (get().remoteSyncStatus === 'syncing') {
            set(markRemoteSyncLocal());
          }
          return;
        }

        const localGoals = get().goals;
        const goalsToPush = getGoalsNeedingRemoteSync(localGoals, remoteGoals);

        set({ goals: mergeGoals(localGoals, remoteGoals) });

        if (goalsToPush.length > 0) {
          try {
            await saveGoalsBatchToApi(goalsToPush);
          } catch (error) {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to push local goals'));
            return;
          }
        }

        set(markRemoteSyncSuccess());
      },

      retryRemoteSync: async () => {
        if (!isGoalApiEnabled()) {
          set(markRemoteSyncLocal());
          return;
        }
        await get().hydrateFromRemote();
      },
    }),
    {
      name: STORAGE_NAMES.goals.current,
      storage: customStorage,
      // Migration: convert old goals (with progress field) to new format
      migrate: (persisted: any) => {
        if (persisted && Array.isArray(persisted.goals)) {
          persisted.goals = persisted.goals.map((g: any) => {
            // Already migrated
            if (g.targetType) return g;
            // Old format: { id, title, progress, createdAt }
            return {
              id: g.id,
              title: g.title,
              targetType: 'milestone' as GoalTargetType,
              targetValue: 100,
              linkedTaskIds: [],
              createdAt: g.createdAt || new Date().toISOString(),
            };
          });
        }
        return persisted as GoalStore;
      },
      version: 1,
    }
  )
);
