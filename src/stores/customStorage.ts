import { createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './authStore';
import { STORAGE_NAMES } from '../config/identity';

const STORAGE_LEGACY_MAP = Object.values(STORAGE_NAMES).reduce<Record<string, string[]>>((map, entry) => {
  map[entry.current] = [...entry.legacy];
  return map;
}, {});

function resolveStorageUserId() {
  return useAuthStore.getState().user?.id || 'guest';
}

function getScopedKey(name: string, userId = resolveStorageUserId()) {
  return `${userId}-${name}`;
}

function getLegacyNames(name: string) {
  return STORAGE_LEGACY_MAP[name] || [];
}

export function readScopedStorageItem(name: string, userId = resolveStorageUserId()) {
  const currentKey = getScopedKey(name, userId);
  const currentValue = localStorage.getItem(currentKey);
  if (currentValue !== null) return currentValue;

  for (const legacyName of getLegacyNames(name)) {
    const legacyKey = getScopedKey(legacyName, userId);
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue === null) continue;

    localStorage.setItem(currentKey, legacyValue);
    localStorage.removeItem(legacyKey);
    return legacyValue;
  }

  return null;
}

export function removeScopedStorageItem(name: string, userId = resolveStorageUserId()) {
  localStorage.removeItem(getScopedKey(name, userId));
  for (const legacyName of getLegacyNames(name)) {
    localStorage.removeItem(getScopedKey(legacyName, userId));
  }
}

export const customStorage = createJSONStorage(() => ({
  getItem: (name: string) => readScopedStorageItem(name),
  setItem: (name: string, value: string) => {
    localStorage.setItem(getScopedKey(name), value);
  },
  removeItem: (name: string) => {
    removeScopedStorageItem(name);
  }
}));
