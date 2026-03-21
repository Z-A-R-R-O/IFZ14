const DEFAULT_SHORT_NAME = 'IFZ14';
const DEFAULT_FULL_NAME = 'InterFrost';
const DEFAULT_DESCRIPTION = 'IFZ14 system architecture. Observe. Calculate. Evolve.';

function readEnvValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const IDENTITY = {
  short: readEnvValue(import.meta.env.VITE_APP_NAME, DEFAULT_SHORT_NAME),
  full: readEnvValue(import.meta.env.VITE_APP_LEGAL, DEFAULT_FULL_NAME),
  description: readEnvValue(import.meta.env.VITE_APP_DESCRIPTION, DEFAULT_DESCRIPTION),
  slug: 'ifz14',
  assets: {
    mark: '/ifz14/ifz14-mark.svg',
    wordmark: '/ifz14/ifz14-wordmark.svg',
    manifest: '/ifz14/site.webmanifest',
  },
} as const;

export const STORAGE_NAMES = {
  auth: { current: 'ifz14-auth-v2', legacy: ['ifz14-auth-v2'] },
  legacyUsers: { current: 'ifz14-users', legacy: ['ifz14-users'] },
  analytics: { current: 'ifz14-analytics-storage', legacy: ['ifz14-analytics-storage'] },
  daily: { current: 'ifz14-daily-entries', legacy: ['ifz14-daily-entries'] },
  goals: { current: 'ifz14-goals', legacy: ['ifz14-goals'] },
  prefs: { current: 'ifz14-prefs', legacy: ['ifz14-prefs'] },
  suggestions: { current: 'ifz14-suggestions', legacy: ['ifz14-suggestions'] },
  tasks: { current: 'ifz14-tasks', legacy: ['ifz14-tasks'] },
} as const;

export function getBrandReportLabel() {
  return `${IDENTITY.short} SYSTEM`;
}
