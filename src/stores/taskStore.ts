import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import type { Task, TaskEnergyType, TaskStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_NAMES } from '../config/identity';

interface TaskStore {
  tasks: Task[];

  // CRUD
  addTask: (data: {
    id?: string;
    title: string;
    priority: Task['priority'];
    estimatedTime: number;
    energyType: TaskEnergyType;
    goalId?: string;
    preferredTime?: 'morning' | 'afternoon' | 'night';
    energyDemand?: 'low' | 'medium' | 'high';
    splitable?: boolean;
    deadline?: string;
  }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  removeTask: (id: string) => void;

  // Session linking
  linkSession: (taskId: string, sessionId: string) => void;
  unlinkSession: (taskId: string) => void;
  addCompletedTime: (taskId: string, amount: number) => void;

  // Auto-split (tasks > 90 min)
  splitTask: (id: string) => void;

  // Score impact
  setScoreImpact: (id: string, expected: number, actual?: number) => void;

  // Selectors
  getActiveTasks: () => Task[];
  getCompletedTasks: () => Task[];
  getDeepTasks: () => Task[];
  getLightTasks: () => Task[];
  getHighPriority: () => Task[];
  getTasksByGoal: (goalId: string) => Task[];

  // Legacy compat
  toggleTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (data) => {
        const id = data.id || uuidv4();
        const task: Task = {
           id,
          title: data.title,
          priority: data.priority,
          estimatedTime: data.estimatedTime,
          completedTime: 0,
          energyType: data.energyType,
          status: 'pending',
          goalId: data.goalId,
          scoreImpact: {
            expected: data.priority === 'HIGH' ? 18 : data.priority === 'MED' ? 10 : 5,
          },
          completed: false,
          createdAt: new Date().toISOString(),
          // Phase 7 Intelligence
          preferredTime: data.preferredTime || 'morning',
          energyDemand: data.energyDemand || 'medium',
          splitable: data.splitable ?? true,
          deadline: data.deadline,
        };
        set((state: TaskStore) => ({ tasks: [task, ...state.tasks] }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      setStatus: (id, status) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  completed: status === 'done',
                  completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
                }
              : t
          ),
        }));
      },

      removeTask: (id) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.filter((t: Task) => t.id !== id),
        }));
      },

      linkSession: (taskId, sessionId) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === taskId ? { ...t, linkedSessionId: sessionId, status: 'active' } : t
          ),
        }));
      },

      unlinkSession: (taskId) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === taskId ? { ...t, linkedSessionId: undefined } : t
          ),
        }));
      },

      addCompletedTime: (taskId, amount) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) => {
            if (t.id !== taskId) return t;
            const updatedTime = Math.min(t.completedTime + amount, t.estimatedTime);
            return {
              ...t,
              completedTime: updatedTime,
              status: updatedTime >= t.estimatedTime ? 'done' : 'active'
            };
          })
        }));
      },

      splitTask: (id) => {
        const task = get().tasks.find((t: Task) => t.id === id);
        if (!task || task.estimatedTime <= 90) return;

        const parts = Math.ceil(task.estimatedTime / 60);
        const partTime = Math.ceil(task.estimatedTime / parts);
        const subtaskIds: string[] = [];

        const subtasks: Task[] = [];
        for (let i = 0; i < parts; i++) {
          const sub: Task = {
            id: uuidv4(),
            title: `${task.title} (Part ${i + 1}/${parts})`,
            priority: task.priority,
            estimatedTime: Math.min(partTime, task.estimatedTime - i * partTime),
            completedTime: 0,
            energyType: task.energyType,
            status: 'pending',
            goalId: task.goalId,
            parentTaskId: task.id,
            scoreImpact: {
              expected: Math.round((task.scoreImpact?.expected || 10) / parts),
            },
            completed: false,
            createdAt: new Date().toISOString(),
          };
          subtasks.push(sub);
          subtaskIds.push(sub.id);
        }

        set((state: TaskStore) => ({
          tasks: [
            ...subtasks,
            ...state.tasks.map((t: Task) =>
              t.id === id ? { ...t, subtaskIds, status: 'done' as TaskStatus } : t
            ),
          ],
        }));
      },

      setScoreImpact: (id, expected, actual) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === id ? { ...t, scoreImpact: { expected, actual } } : t
          ),
        }));
      },

      // Selectors
      getActiveTasks: () => get().tasks.filter((t: Task) => !t.completed && t.status !== 'skipped'),
      getCompletedTasks: () => get().tasks.filter((t: Task) => t.completed),
      getDeepTasks: () => get().tasks.filter((t: Task) => t.energyType === 'deep' && !t.completed),
      getLightTasks: () => get().tasks.filter((t: Task) => t.energyType !== 'deep' && !t.completed),
      getHighPriority: () => get().tasks.filter((t: Task) => t.priority === 'HIGH' && !t.completed),
      getTasksByGoal: (goalId) => get().tasks.filter((t: Task) => t.goalId === goalId),

      // Legacy compat
      toggleTask: (id) => {
        const task = get().tasks.find((t: Task) => t.id === id);
        if (!task) return;
        const newStatus: TaskStatus = task.completed ? 'pending' : 'done';
        get().setStatus(id, newStatus);
      },
    }),
    {
      name: STORAGE_NAMES.tasks.current,
      storage: customStorage,
    }
  )
);
