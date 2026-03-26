import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BiometricProfile, WeightLogEntry, WorkoutLogEntry, BodyHabit } from '../types';
import { customStorage } from './customStorage';

interface BiometricState {
  profile: BiometricProfile;
  weightLog: WeightLogEntry[];
  workoutLog: WorkoutLogEntry[];
  habits: BodyHabit[];

  // Profile actions
  updateProfile: (updates: Partial<BiometricProfile>) => void;

  // Weight actions
  addWeightEntry: (entry: WeightLogEntry) => void;
  removeWeightEntry: (date: string) => void;

  // Workout actions
  addWorkout: (entry: WorkoutLogEntry) => void;
  removeWorkout: (date: string, name: string) => void;

  // Habit actions
  addHabit: (habit: Omit<BodyHabit, 'id' | 'order'>) => void;
  updateHabit: (id: string, updates: Partial<BodyHabit>) => void;
  removeHabit: (id: string) => void;
  toggleHabitActive: (id: string) => void;
  reorderHabits: (ids: string[]) => void;
}

const DEFAULT_PROFILE: BiometricProfile = {
  heightCm: 175,
  weightKg: 70,
  age: 25,
  gender: 'male',
  activityLevel: 'moderate',
  goalType: 'maintain',
};

const DEFAULT_HABITS: BodyHabit[] = [
  { id: 'gym', name: 'Gym Training', type: 'toggle', icon: '', isActive: true, order: 0 },
  { id: 'jawline', name: 'Jawline Workout', type: 'toggle', icon: '', isActive: true, order: 1 },
  { id: 'cold-shower', name: 'Cold Shower', type: 'toggle', icon: '', isActive: true, order: 2 },
  { id: 'stretching', name: 'Stretching', type: 'duration', icon: '', isActive: true, order: 3 },
  { id: 'posture', name: 'Posture Check', type: 'rating', icon: '', isActive: false, order: 4 },
  { id: 'hydration', name: 'Water Intake', type: 'rating', icon: '', isActive: false, order: 5 },
  { id: 'skincare', name: 'Skincare Routine', type: 'toggle', icon: '', isActive: false, order: 6 },
  { id: 'meditation', name: 'Meditation', type: 'duration', icon: '', isActive: false, order: 7 },
];

let _nextId = 100;

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      weightLog: [],
      workoutLog: [],
      habits: DEFAULT_HABITS,

      updateProfile: (updates) =>
        set((s) => ({ profile: { ...s.profile, ...updates } })),

      addWeightEntry: (entry) =>
        set((s) => {
          const filtered = s.weightLog.filter((e) => e.date !== entry.date);
          return { weightLog: [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date)) };
        }),

      removeWeightEntry: (date) =>
        set((s) => ({ weightLog: s.weightLog.filter((e) => e.date !== date) })),

      addWorkout: (entry) =>
        set((s) => ({
          workoutLog: [...s.workoutLog, entry].sort((a, b) => a.date.localeCompare(b.date)),
        })),

      removeWorkout: (date, name) =>
        set((s) => ({
          workoutLog: s.workoutLog.filter((e) => !(e.date === date && e.name === name)),
        })),

      // ─── Habit CRUD ───

      addHabit: (habit) =>
        set((s) => {
          const id = `custom-${++_nextId}-${Date.now()}`;
          const order = s.habits.length;
          return { habits: [...s.habits, { ...habit, id, order }] };
        }),

      updateHabit: (id, updates) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      removeHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id).map((h, i) => ({ ...h, order: i })),
        })),

      toggleHabitActive: (id) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, isActive: !h.isActive } : h)),
        })),

      reorderHabits: (ids) =>
        set((s) => ({
          habits: ids.map((id, i) => {
            const h = s.habits.find((x) => x.id === id);
            return h ? { ...h, order: i } : null;
          }).filter(Boolean) as BodyHabit[],
        })),
    }),
    {
      name: 'ifz14-biometrics',
      storage: customStorage,
    }
  )
);
