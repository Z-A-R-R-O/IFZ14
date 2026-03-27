import type { DailyEntry } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { buildApiHeaders } from './client';

type RemoteDailyEntryRow = {
  date: string;
  payload: DailyEntry | string;
  updatedAt?: string;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

export function isDailyApiEnabled() {
  return Boolean(getApiBaseUrl());
}

function getCurrentUserId() {
  return useAuthStore.getState().user?.id || '';
}

function normalizeRemoteEntry(row: RemoteDailyEntryRow) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) as DailyEntry : row.payload;
  return {
    ...payload,
    date: payload.date || row.date,
    updatedAt: payload.updatedAt || row.updatedAt || new Date().toISOString(),
  } satisfies DailyEntry;
}

export async function hydrateDailyEntriesFromApi() {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return null;

  const response = await fetch(`${apiBaseUrl}/api/daily-entries?userId=${encodeURIComponent(userId)}`, {
    headers: buildApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to hydrate daily entries: ${response.status}`);
  }

  const data = await response.json() as { entries?: RemoteDailyEntryRow[] };
  const rows = Array.isArray(data.entries) ? data.entries : [];

  return rows.reduce<Record<string, DailyEntry>>((entries, row) => {
    const entry = normalizeRemoteEntry(row);
    entries[entry.date] = entry;
    return entries;
  }, {});
}

export async function saveDailyEntryToApi(entry: DailyEntry) {
  const apiBaseUrl = getApiBaseUrl();
  const userId = getCurrentUserId();

  if (!apiBaseUrl || !userId) return;

  const response = await fetch(`${apiBaseUrl}/api/daily-entries/${encodeURIComponent(entry.date)}`, {
    method: 'PUT',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      userId,
      payload: entry,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save daily entry: ${response.status}`);
  }
}

export async function saveDailyEntriesBatchToApi(entries: DailyEntry[]) {
  for (const entry of entries) {
    await saveDailyEntryToApi(entry);
  }
}
