import type { DailyEntry, PatternResult, Trend } from '../types';
import { calculateScore } from './scoreEngine';

/**
 * Pattern Engine — Analyzes recent entries to detect trends.
 * Looks at 7-14 day windows for RISING / DECLINING / STABLE / VOLATILE.
 */

export function detectPattern(entries: DailyEntry[]): PatternResult {
  if (entries.length < 3) {
    return { trend: 'STABLE', description: 'Insufficient data for pattern detection' };
  }

  const recent = entries.slice(-14);
  const scores = recent.map(e => calculateScore(e).score);
  const len = scores.length;

  // Calculate trend via linear regression slope
  const xMean = (len - 1) / 2;
  const yMean = scores.reduce((a, b) => a + b, 0) / len;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < len; i++) {
    numerator += (i - xMean) * (scores[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate volatility (standard deviation)
  const variance = scores.reduce((sum, s) => sum + (s - yMean) ** 2, 0) / len;
  const stdDev = Math.sqrt(variance);

  let trend: Trend;
  let description: string;

  if (stdDev > 15) {
    trend = 'VOLATILE';
    description = `Performance is inconsistent — fluctuating ±${Math.round(stdDev)} points`;
  } else if (slope > 1.5) {
    trend = 'RISING';
    description = `Improving for ${len} days — avg score ${Math.round(yMean)}`;
  } else if (slope < -1.5) {
    trend = 'DECLINING';
    description = `Declining over ${len} days — watch for burnout`;
  } else {
    trend = 'STABLE';
    description = `Holding steady at ~${Math.round(yMean)} — consistency is key`;
  }

  return { trend, description };
}
