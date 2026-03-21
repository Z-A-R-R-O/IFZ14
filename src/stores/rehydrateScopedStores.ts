import { useAnalyticsStore } from './analyticsStore';
import { useDailyStore } from './dailyStore';
import { useGoalStore } from './goalStore';
import { usePrefsStore } from './prefsStore';
import { useSuggestionStore } from './suggestionStore';
import { useTaskStore } from './taskStore';

const scopedStores = [
  useDailyStore,
  useTaskStore,
  useGoalStore,
  useAnalyticsStore,
  usePrefsStore,
  useSuggestionStore,
] as const;

export async function rehydrateScopedStores() {
  await Promise.all(scopedStores.map((store) => store.persist.rehydrate()));
}
