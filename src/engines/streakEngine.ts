import type { DailyEntry, StreakData } from '../types';
import { calculateScore } from './scoreEngine';

/**
 * Streak Engine — Tracks consecutive days of key behaviors.
 * Counts backwards from most recent entry.
 */

export function calculateStreaks(entries: DailyEntry[]): StreakData {
  if (entries.length === 0) {
    return { gym: 0, deepWork: 0, earlyWake: 0, highScore: 0 };
  }

  // Sort by date descending (most recent first)
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  let gym = 0;
  let deepWork = 0;
  let earlyWake = 0;
  let highScore = 0;

  // Count consecutive gym days
  for (const entry of sorted) {
    if (entry.gymTraining === 'completed' || entry.gymTraining === 'partial') {
      gym++;
    } else break;
  }

  // Count consecutive deep work days (focus > 6)
  for (const entry of sorted) {
    if ((entry.dw1FocusQuality || 0) >= 6 || (entry.dw2FocusQuality || 0) >= 6) {
      deepWork++;
    } else break;
  }

  // Count consecutive early wake days (before 06:30)
  for (const entry of sorted) {
    if (entry.actualWakeTime && entry.actualWakeTime <= '06:30') {
      earlyWake++;
    } else break;
  }

  // Count consecutive high score days (>= 70)
  for (const entry of sorted) {
    const { score } = calculateScore(entry);
    if (score >= 70) {
      highScore++;
    } else break;
  }

  return { gym, deepWork, earlyWake, highScore };
}
