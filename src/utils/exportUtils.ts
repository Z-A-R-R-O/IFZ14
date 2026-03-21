import type { DailyEntry } from '../types';
import { useDailyStore } from '../stores/dailyStore';
import { useTaskStore } from '../stores/taskStore';
import { useGoalStore } from '../stores/goalStore';
import { calculateScore } from '../engines/scoreEngine';
import { generateWeeklyReport } from '../engines/analyticsEngine';
import { format } from 'date-fns';
import { STORAGE_NAMES } from '../config/identity';
import { removeScopedStorageItem } from '../stores/customStorage';

export function exportCSV() {
  const entries = Object.values(useDailyStore.getState().entries).filter((e: DailyEntry) => e.completed);
  if (entries.length === 0) return;

  const headers = [
    'Date', 'Score', 'State', 'Wake Time', 'Sleep Hours', 'Energy',
    'Gym', 'Jaw', 'DW1 Focus', 'DW2 Focus', 'Output Score',
    'Body', 'Mind', 'Intelligence', 'Skills', 'Product', 'Money', 'Social', 'Environment',
  ];

  const rows = entries
    .sort((a: DailyEntry, b: DailyEntry) => a.date.localeCompare(b.date))
    .map((e) => {
      const { score, state } = calculateScore(e);
      return [
        e.date, score, state, e.actualWakeTime, e.totalSleepHours, e.energyLevel,
        e.gymTraining, e.jawlineWorkout ? 'Y' : 'N',
        e.dw1FocusQuality, e.dw2FocusQuality, e.outputScore,
        e.domainBody, e.domainMind, e.domainIntelligence, e.domainSkills,
        e.domainProduct, e.domainMoney, e.domainSocial, e.domainEnvironment,
      ].join(',');
    });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(csv, `ifz14-data-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
}

export function exportReport() {
  const entries = Object.values(useDailyStore.getState().entries).filter((e: DailyEntry) => e.completed) as DailyEntry[];
  const tasks = useTaskStore.getState().tasks;
  const goals = useGoalStore.getState().goals;

  const doc = generateWeeklyReport(entries, goals, tasks);

  downloadFile(doc, `ifz14-report-${format(new Date(), 'yyyy-MM-dd')}.txt`, 'text/plain');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function deleteAllData() {
  // Clear all stores
  useDailyStore.getState().entries = {};
  useTaskStore.getState().tasks = [];
  useGoalStore.getState().goals = [];

  // Clear persisted user-scoped storage, including legacy aliases
  removeScopedStorageItem(STORAGE_NAMES.daily.current);
  removeScopedStorageItem(STORAGE_NAMES.tasks.current);
  removeScopedStorageItem(STORAGE_NAMES.goals.current);
  removeScopedStorageItem(STORAGE_NAMES.analytics.current);
  removeScopedStorageItem(STORAGE_NAMES.prefs.current);
  removeScopedStorageItem(STORAGE_NAMES.suggestions.current);

  // Reload to reset state
  window.location.reload();
}
