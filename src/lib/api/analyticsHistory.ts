import type { AnalyticsHistory } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { buildApiHeaders } from './client';

type RemoteAnalyticsHistoryRow = {
  id: string;
  payload: AnalyticsHistory | string;
  updatedAt?: string;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

function getCurrentUserId() {
  return useAuthStore.getState().user?.id || '';
}

export function isAnalyticsApiEnabled() {
  return Boolean(getApiBaseUrl());
}

function normalizeRemoteAnalyticsHistory(row: RemoteAnalyticsHistoryRow) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) as AnalyticsHistory : row.payload;
  return {
    ...payload,
    id: payload.id || row.id,
  } satisfies AnalyticsHistory;
}

export async function hydrateAnalyticsHistoryFromApi() {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return null;

  const response = await fetch(`${apiBaseUrl}/api/analytics-history?userId=${encodeURIComponent(userId)}`, {
    headers: buildApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to hydrate analytics history: ${response.status}`);
  }

  const data = await response.json() as { history?: RemoteAnalyticsHistoryRow[] };
  const rows = Array.isArray(data.history) ? data.history : [];
  return rows.map(normalizeRemoteAnalyticsHistory);
}

export async function saveAnalyticsHistoryToApi(history: AnalyticsHistory) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/analytics-history/${encodeURIComponent(history.id)}`, {
    method: 'PUT',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      userId,
      payload: history,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save analytics history: ${response.status}`);
  }
}

export async function saveAnalyticsHistoryBatchToApi(history: AnalyticsHistory[]) {
  for (const item of history) {
    await saveAnalyticsHistoryToApi(item);
  }
}
