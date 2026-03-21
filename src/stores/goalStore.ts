import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import type { Goal, GoalTargetType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_NAMES } from '../config/identity';

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

interface GoalStore {
  goals: Goal[];

  // CRUD
  createGoal: (data: CreateGoalData) => void;
  deleteGoal: (id: string) => void;

  // Linking
  linkTask: (goalId: string, taskId: string) => void;
  unlinkTask: (goalId: string, taskId: string) => void;

  // Update
  updateGoal: (id: string, updates: Partial<Pick<Goal, 'title' | 'targetValue' | 'deadline' | 'trackDeepWork' | 'milestoneCompleted'>>) => void;
}

export const useGoalStore = create<GoalStore>()(
  persist(
    (set) => ({
      goals: [],

      createGoal: (data: CreateGoalData) => {
        const goal: Goal = {
          id: uuidv4(),
          title: data.title,
          targetType: data.targetType,
          targetValue: data.targetValue,
          linkedTaskIds: data.linkedTaskIds || [],
          trackDeepWork: data.trackDeepWork,
          deadline: data.deadline,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ goals: [...state.goals, goal] }));
      },

      deleteGoal: (id: string) => {
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
      },

      linkTask: (goalId: string, taskId: string) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId && !g.linkedTaskIds.includes(taskId)
              ? { ...g, linkedTaskIds: [...g.linkedTaskIds, taskId] }
              : g
          ),
        }));
      },

      unlinkTask: (goalId: string, taskId: string) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? { ...g, linkedTaskIds: g.linkedTaskIds.filter((id) => id !== taskId) }
              : g
          ),
        }));
      },

      updateGoal: (id: string, updates) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
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
