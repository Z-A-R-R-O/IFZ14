import type { Goal } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { buildApiHeaders } from './client';

type RemoteGoalRow = {
  id: string;
  payload: Goal | string;
  updatedAt?: string;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

function getCurrentUserId() {
  return useAuthStore.getState().user?.id || '';
}

export function isGoalApiEnabled() {
  return Boolean(getApiBaseUrl());
}

function normalizeRemoteGoal(row: RemoteGoalRow) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) as Goal : row.payload;
  return {
    ...payload,
    id: payload.id || row.id,
    updatedAt: payload.updatedAt || row.updatedAt || payload.createdAt || new Date().toISOString(),
  } satisfies Goal;
}

export async function hydrateGoalsFromApi() {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return null;

  const response = await fetch(`${apiBaseUrl}/api/goals?userId=${encodeURIComponent(userId)}`, {
    headers: buildApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to hydrate goals: ${response.status}`);
  }

  const data = await response.json() as { goals?: RemoteGoalRow[] };
  const rows = Array.isArray(data.goals) ? data.goals : [];
  return rows.map(normalizeRemoteGoal);
}

export async function saveGoalToApi(goal: Goal) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/goals/${encodeURIComponent(goal.id)}`, {
    method: 'PUT',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      userId,
      payload: goal,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save goal: ${response.status}`);
  }
}

export async function saveGoalsBatchToApi(goals: Goal[]) {
  for (const goal of goals) {
    await saveGoalToApi(goal);
  }
}

export async function deleteGoalFromApi(goalId: string) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/goals/${encodeURIComponent(goalId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: buildApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete goal: ${response.status}`);
  }
}
