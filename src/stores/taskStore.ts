import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customStorage } from './customStorage';
import type { Task, TaskEnergyType, TaskStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_NAMES } from '../config/identity';
import { deleteTaskFromApi, hydrateTasksFromApi, isTaskApiEnabled, saveTasksBatchToApi } from '../lib/api/tasks';
import { createInitialRemoteSyncState, markRemoteSyncError, markRemoteSyncLocal, markRemoteSyncStart, markRemoteSyncSuccess, type RemoteSyncState } from './remoteSync';

interface TaskStore extends RemoteSyncState {
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
  hydrateFromRemote: () => Promise<void>;
  retryRemoteSync: () => Promise<void>;
}

function getTaskUpdatedAt(task: Task) {
  return new Date(task.updatedAt || task.completedAt || task.createdAt).getTime();
}

function mergeTasks(localTasks: Task[], remoteTasks: Task[]) {
  const merged = new Map<string, Task>();

  for (const task of remoteTasks) {
    merged.set(task.id, task);
  }

  for (const localTask of localTasks) {
    const remoteTask = merged.get(localTask.id);
    if (!remoteTask || getTaskUpdatedAt(localTask) >= getTaskUpdatedAt(remoteTask)) {
      merged.set(localTask.id, localTask);
    }
  }

  return Array.from(merged.values()).sort((left, right) => getTaskUpdatedAt(right) - getTaskUpdatedAt(left));
}

function getTasksNeedingRemoteSync(localTasks: Task[], remoteTasks: Task[]) {
  const remoteTaskMap = new Map(remoteTasks.map((task) => [task.id, task]));
  return localTasks.filter((localTask) => {
    const remoteTask = remoteTaskMap.get(localTask.id);
    if (!remoteTask) return true;
    return getTaskUpdatedAt(localTask) > getTaskUpdatedAt(remoteTask);
  });
}

function syncTaskMutation(
  get: () => TaskStore,
  set: (partial: Partial<TaskStore>) => void,
  taskOrTasks: Task | Task[] | null,
  fallbackMessage: string
) {
  if (!taskOrTasks || !isTaskApiEnabled()) return;

  const tasks = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];
  set(markRemoteSyncStart());

  void saveTasksBatchToApi(tasks).catch((error) => {
    set(markRemoteSyncError(error instanceof Error ? error.message : fallbackMessage));
  }).then(() => {
    if (!get().remoteSyncError) {
      set(markRemoteSyncSuccess());
    }
  });
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      ...createInitialRemoteSyncState(),

      addTask: (data) => {
        const id = data.id || uuidv4();
        const now = new Date().toISOString();
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
          createdAt: now,
          updatedAt: now,
          // Phase 7 Intelligence
          preferredTime: data.preferredTime || 'morning',
          energyDemand: data.energyDemand || 'medium',
          splitable: data.splitable ?? true,
          deadline: data.deadline,
        };
        set((state: TaskStore) => ({ tasks: [task, ...state.tasks] }));
        syncTaskMutation(get, set, task, 'Failed to sync task');
        return id;
      },

      updateTask: (id, updates) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) => {
            if (t.id !== id) return t;
            nextTask = { ...t, ...updates, updatedAt: new Date().toISOString() };
            return nextTask;
          }),
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync task');
      },

      setStatus: (id, status) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === id
              ? (nextTask = {
                  ...t,
                  status,
                  completed: status === 'done',
                  completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
                  updatedAt: new Date().toISOString(),
                })
              : t
          ),
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync task status');
      },

      removeTask: (id) => {
        set((state: TaskStore) => ({
          tasks: state.tasks.filter((t: Task) => t.id !== id),
        }));
        if (isTaskApiEnabled()) {
          set(markRemoteSyncStart());
          void deleteTaskFromApi(id).catch((error) => {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to delete task remotely'));
          }).then(() => {
            if (!get().remoteSyncError) {
              set(markRemoteSyncSuccess());
            }
          });
        }
      },

      linkSession: (taskId, sessionId) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === taskId ? (nextTask = { ...t, linkedSessionId: sessionId, status: 'active', updatedAt: new Date().toISOString() }) : t
          ),
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync linked task');
      },

      unlinkSession: (taskId) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === taskId ? (nextTask = { ...t, linkedSessionId: undefined, updatedAt: new Date().toISOString() }) : t
          ),
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync unlinked task');
      },

      addCompletedTime: (taskId, amount) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) => {
            if (t.id !== taskId) return t;
            const updatedTime = Math.min(t.completedTime + amount, t.estimatedTime);
            nextTask = {
              ...t,
              completedTime: updatedTime,
              status: updatedTime >= t.estimatedTime ? 'done' : 'active',
              updatedAt: new Date().toISOString(),
            };
            return nextTask;
          })
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync task progress');
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
            updatedAt: new Date().toISOString(),
          };
          subtasks.push(sub);
          subtaskIds.push(sub.id);
        }

        let parentTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: [
            ...subtasks,
            ...state.tasks.map((t: Task) =>
              t.id === id ? (parentTask = { ...t, subtaskIds, status: 'done' as TaskStatus, updatedAt: new Date().toISOString() }) : t
            ),
          ],
        }));
        syncTaskMutation(get, set, parentTask ? [parentTask, ...subtasks] : subtasks, 'Failed to sync split task');
      },

      setScoreImpact: (id, expected, actual) => {
        let nextTask: Task | null = null;
        set((state: TaskStore) => ({
          tasks: state.tasks.map((t: Task) =>
            t.id === id ? (nextTask = { ...t, scoreImpact: { expected, actual }, updatedAt: new Date().toISOString() }) : t
          ),
        }));
        syncTaskMutation(get, set, nextTask, 'Failed to sync task score impact');
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

      hydrateFromRemote: async () => {
        set(markRemoteSyncStart());
        let remoteTasks: Task[] | null = null;
        try {
          remoteTasks = await hydrateTasksFromApi();
        } catch (error) {
          set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to hydrate tasks'));
        }

        if (!remoteTasks) {
          if (get().remoteSyncStatus === 'syncing') {
            set(markRemoteSyncLocal());
          }
          return;
        }

        const localTasks = get().tasks;
        const tasksToPush = getTasksNeedingRemoteSync(localTasks, remoteTasks);

        set({ tasks: mergeTasks(localTasks, remoteTasks) });

        if (tasksToPush.length > 0) {
          try {
            await saveTasksBatchToApi(tasksToPush);
          } catch (error) {
            set(markRemoteSyncError(error instanceof Error ? error.message : 'Failed to push local tasks'));
            return;
          }
        }

        set(markRemoteSyncSuccess());
      },

      retryRemoteSync: async () => {
        if (!isTaskApiEnabled()) {
          set(markRemoteSyncLocal());
          return;
        }
        await get().hydrateFromRemote();
      },
    }),
    {
      name: STORAGE_NAMES.tasks.current,
      storage: customStorage,
    }
  )
);
