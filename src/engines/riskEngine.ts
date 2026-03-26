import type { DailyEntry, RiskSignal } from '../types';
import { calculateScore } from './scoreEngine';
import { getDeepWorkFocus } from './dwExtractors';
import { getBodySignal, hasBodyRoutineConfigured } from './systemSignals';

/**
 * Risk Engine — Detects burnout, drop, and overwork signals.
 * Analyzes recent behavior patterns for warning signs.
 */

export function assessRisk(entries: DailyEntry[]): RiskSignal {
  if (entries.length < 3) {
    return { level: 'NONE', signals: [] };
  }

  const signals: string[] = [];
  const recent = entries.slice(-7);
  const scores = recent.map(e => calculateScore(e).score);

  // Check for declining scores (3+ consecutive drops)
  let consecutiveDrops = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] < scores[i - 1]) consecutiveDrops++;
    else consecutiveDrops = 0;
  }
  if (consecutiveDrops >= 3) {
    signals.push(`Score declining for ${consecutiveDrops} consecutive days`);
  }

  // Check for body-system misses across tracked or planned body routines
  const trackedBodyDays = recent.filter(hasBodyRoutineConfigured);
  const missedBody = trackedBodyDays.filter((entry) => getBodySignal(entry) < 40).length;
  if (trackedBodyDays.length >= 3 && missedBody >= 3) {
    signals.push(`Body system failed ${missedBody} of last ${trackedBodyDays.length} tracked days`);
  }

  // Check for low energy pattern
  const avgEnergy = recent.reduce((s, e) => s + (e.efficiencyRating ?? e.energyLevel ?? 0), 0) / recent.length;
  if (avgEnergy < 4) {
    signals.push(`Average energy dangerously low at ${avgEnergy.toFixed(1)}/10`);
  }

  // Check for sleep debt
  const avgSleep = recent.reduce((s, e) => s + (e.totalSleepHours || 0), 0) / recent.length;
  if (avgSleep > 0 && avgSleep < 6) {
    signals.push(`Sleep averaging ${avgSleep.toFixed(1)}h — sleep debt accumulating`);
  }

  // Check for low deep work focus
  const avgFocus = recent.reduce((s, e) => s + getDeepWorkFocus(e), 0) / recent.length;
  if (avgFocus < 4) {
    signals.push('Deep work focus critically low — consider recovery day');
  }

  // Determine risk level
  let level: RiskSignal['level'] = 'NONE';
  if (signals.length >= 4) level = 'HIGH';
  else if (signals.length >= 2) level = 'MODERATE';
  else if (signals.length >= 1) level = 'LOW';

  return { level, signals };
}
