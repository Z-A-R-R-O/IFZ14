import { create } from 'zustand';
import type { AutoDayPlan, AutoDayPhase, AdaptiveQuestion } from '../types';

interface AutoDayUserInputs {
  energy?: number;
  sleep?: number;
  intent?: string;
  yesterdayIssue?: string;
  constraints?: string;
}

interface AutoDayStore {
  // State
  phase: AutoDayPhase;
  plan: AutoDayPlan | null;
  builderData: AutoDayPlan | null;
  userInputs: AutoDayUserInputs;
  questions: AdaptiveQuestion[];
  computingStep: number;           // 0-3 for animated steps
  lockedAt: string | null;
  isModifiedAfterLock: boolean;

  // Actions
  initiate: (questions: AdaptiveQuestion[]) => void;
  setUserInput: (key: string, value: any) => void;
  setPhase: (phase: AutoDayPhase) => void;
  setPlan: (plan: AutoDayPlan) => void;
  setComputingStep: (step: number) => void;
  openBuilder: (plan: AutoDayPlan) => void;
  lockDay: () => void;
  markModified: () => void;
  recalibrate: () => void;
  reset: () => void;
}

export const useAutoDayStore = create<AutoDayStore>()(
  (set) => ({
    phase: 'idle',
    plan: null,
    builderData: null,
    userInputs: {},
    questions: [],
    computingStep: 0,
    lockedAt: null,
    isModifiedAfterLock: false,

    initiate: (questions) => set({
      phase: 'questions',
      questions,
      plan: null,
      userInputs: {},
      computingStep: 0,
      lockedAt: null,
      isModifiedAfterLock: false,
    }),

    setUserInput: (key, value) => set((s) => ({
      userInputs: { ...s.userInputs, [key]: value },
    })),

    setPhase: (phase) => set({ phase }),

    setPlan: (plan) => set({ plan, phase: 'preview' }),

    setComputingStep: (step) => set({ computingStep: step }),

    openBuilder: (plan) => set({
      builderData: plan,
      phase: 'idle',
    }),

    lockDay: () => set({
      phase: 'locked',
      lockedAt: new Date().toISOString(),
      isModifiedAfterLock: false,
    }),

    markModified: () => set((s) => ({
      isModifiedAfterLock: s.phase === 'locked' ? true : s.isModifiedAfterLock,
    })),

    recalibrate: () => set({
      phase: 'recalibrating',
      computingStep: 0,
    }),

    reset: () => set({
      phase: 'idle',
      plan: null,
      builderData: null,
      userInputs: {},
      questions: [],
      computingStep: 0,
      lockedAt: null,
      isModifiedAfterLock: false,
    }),
  })
);
