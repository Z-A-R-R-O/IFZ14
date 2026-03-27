import { avg } from '../../../engines/analyticsEngine';
import { calculateScore } from '../../../engines/scoreEngine';
import { detectPattern } from '../../../engines/patternEngine';
import { calculateStreaks } from '../../../engines/streakEngine';
import type { DailyEntry } from '../../../types';

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getDeepMinutes(entry: DailyEntry) {
  if (entry.dynamic_values?.dwSessions?.length) {
    return entry.dynamic_values.dwSessions.reduce((sum: number, session: any) => sum + (session.duration || 60), 0);
  }

  const qualities = [entry.dw1FocusQuality || 0, entry.dw2FocusQuality || 0].filter(Boolean);
  return qualities.reduce((sum, quality) => sum + quality * 12, 0);
}

export function getFocusSignal(entry: DailyEntry) {
  if (entry.dynamic_values?.dwSessions?.length) {
    return avg(entry.dynamic_values.dwSessions.map((session: any) => session.focus || 0));
  }

  const qualities = [entry.dw1FocusQuality || 0, entry.dw2FocusQuality || 0].filter(Boolean);
  return qualities.length > 0 ? avg(qualities) * 10 : 0;
}

export function formatTrend(trend: ReturnType<typeof detectPattern>['trend']) {
  if (trend === 'RISING') return 'IMPROVING';
  if (trend === 'DECLINING') return 'DECLINING';
  if (trend === 'VOLATILE') return 'VOLATILE';
  return 'STABLE';
}

export function formatArchiveDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

export function buildMemory(entries: DailyEntry[], streaks: ReturnType<typeof calculateStreaks>) {
  if (entries.length === 0) return [];

  const scored = entries.map(entry => ({ entry, score: calculateScore(entry).score }));
  const highest = [...scored].sort((left, right) => right.score - left.score)[0];
  const lowestEnergy = [...entries]
    .filter(entry => (entry.efficiencyRating ?? entry.energyLevel) !== undefined)
    .sort((left, right) => (left.efficiencyRating ?? left.energyLevel ?? 0) - (right.efficiencyRating ?? right.energyLevel ?? 0))[0];
  const deepest = [...entries].sort((left, right) => getDeepMinutes(right) - getDeepMinutes(left))[0];

  const lines = [
    highest ? `Highest output day recorded on ${formatArchiveDate(highest.entry.date)} at ${highest.score}.` : '',
    deepest ? `Longest deep work day logged on ${formatArchiveDate(deepest.date)} with ${Math.round((getDeepMinutes(deepest) / 60) * 10) / 10}h focused.` : '',
    lowestEnergy ? `Lowest efficiency period occurred on ${formatArchiveDate(lowestEnergy.date)} at ${lowestEnergy.efficiencyRating ?? lowestEnergy.energyLevel ?? 0}/10.` : '',
    streaks.highScore > 0 ? `Longest active high-performance streak is ${streaks.highScore} days.` : '',
  ];

  return lines.filter(Boolean).slice(0, 4);
}
