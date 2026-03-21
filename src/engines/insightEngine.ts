import type { DailyEntry, Insight } from '../types';
import { calculateScore } from './scoreEngine';
import { detectPattern } from './patternEngine';
import { calculateStreaks } from './streakEngine';
import { assessRisk } from './riskEngine';

/**
 * Insight Engine — Converts raw engine outputs into human-readable sentences.
 * The voice of the system.
 */

export function generateInsights(entries: DailyEntry[]): Insight[] {
  if (entries.length === 0) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(-7);
  const latest = entries[entries.length - 1];

  // Pattern insights
  if (entries.length >= 3) {
    const pattern = detectPattern(entries);
    if (pattern.trend === 'RISING') {
      insights.push({ text: pattern.description, type: 'positive' });
    } else if (pattern.trend === 'DECLINING') {
      insights.push({ text: pattern.description, type: 'warning' });
    } else if (pattern.trend === 'VOLATILE') {
      insights.push({ text: pattern.description, type: 'warning' });
    }
  }

  // Streak insights
  const streaks = calculateStreaks(entries);
  if (streaks.gym >= 3) {
    insights.push({ text: `Gym streak: ${streaks.gym} days straight`, type: 'positive' });
  }
  if (streaks.deepWork >= 3) {
    insights.push({ text: `Deep work streak: ${streaks.deepWork} consecutive high-focus days`, type: 'positive' });
  }
  if (streaks.earlyWake >= 3) {
    insights.push({ text: `Early wake discipline: ${streaks.earlyWake} days before 06:30`, type: 'positive' });
  }
  if (streaks.highScore >= 5) {
    insights.push({ text: `Sustaining high performance for ${streaks.highScore} days`, type: 'positive' });
  }

  // Risk insights
  const risk = assessRisk(entries);
  for (const signal of risk.signals) {
    insights.push({ text: signal, type: 'warning' });
  }

  // Deep work timing insight
  if (recent.length >= 3) {
    const morningBetter = recent.filter(e => (e.dw1FocusQuality || 0) > (e.dw2FocusQuality || 0)).length;
    if (morningBetter > recent.length * 0.7) {
      insights.push({ text: 'Deep work strongest in morning window', type: 'neutral' });
    } else if (morningBetter < recent.length * 0.3) {
      insights.push({ text: 'Afternoon deep work sessions outperforming mornings', type: 'neutral' });
    }
  }

  // Sleep-performance correlation
  if (recent.length >= 3) {
    const highSleepDays = recent.filter(e => (e.totalSleepHours || 0) >= 7);
    const lowSleepDays = recent.filter(e => (e.totalSleepHours || 0) > 0 && (e.totalSleepHours || 0) < 6);
    if (highSleepDays.length > 0 && lowSleepDays.length > 0) {
      const highSleepAvgScore = highSleepDays.reduce((s, e) => s + calculateScore(e).score, 0) / highSleepDays.length;
      const lowSleepAvgScore = lowSleepDays.reduce((s, e) => s + calculateScore(e).score, 0) / lowSleepDays.length;
      if (highSleepAvgScore - lowSleepAvgScore > 10) {
        insights.push({ text: 'Sleep directly impacts your deep work — prioritize 7h+', type: 'neutral' });
      }
    }
  }

  // Today's score context
  if (latest) {
    const { score } = calculateScore(latest);
    if (score >= 85) {
      insights.push({ text: 'Peak performance day — protect this momentum', type: 'positive' });
    } else if (score <= 35) {
      insights.push({ text: 'System running low — consider recovery protocol', type: 'warning' });
    }
  }

  return insights.slice(0, 5); // Cap at 5 most relevant
}
