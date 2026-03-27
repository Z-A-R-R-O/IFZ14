import type { Task } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { buildApiHeaders } from './client';

type RemoteTaskRow = {
  id: string;
  payload: Task | string;
  updatedAt?: string;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

function getCurrentUserId() {
  return useAuthStore.getState().user?.id || '';
}

export function isTaskApiEnabled() {
  return Boolean(getApiBaseUrl());
}

function normalizeRemoteTask(row: RemoteTaskRow) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) as Task : row.payload;
  return {
    ...payload,
    id: payload.id || row.id,
  } satisfies Task;
}

export async function hydrateTasksFromApi() {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return null;

  const response = await fetch(`${apiBaseUrl}/api/tasks?userId=${encodeURIComponent(userId)}`, {
    headers: buildApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to hydrate tasks: ${response.status}`);
  }

  const data = await response.json() as { tasks?: RemoteTaskRow[] };
  const rows = Array.isArray(data.tasks) ? data.tasks : [];

  return rows.map(normalizeRemoteTask);
}

export async function saveTaskToApi(task: Task) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      userId,
      payload: task,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save task: ${response.status}`);
  }
}

export async function saveTasksBatchToApi(tasks: Task[]) {
  for (const task of tasks) {
    await saveTaskToApi(task);
  }
}

export async function deleteTaskFromApi(taskId: string) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/tasks/${encodeURIComponent(taskId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: buildApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete task: ${response.status}`);
  }
}
