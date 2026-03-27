import type { DailyEntry, CausalInsight } from '../../../types';
import { calculateScore } from '../../../engines/scoreEngine';

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatSignalLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function getFocusSignal(entry: DailyEntry) {
  const dynamicSessions = entry.dynamic_values?.dwSessions ?? [];
  if (dynamicSessions.length > 0) {
    return Math.round(avg(dynamicSessions.map((session: any) => session.focus || session.quality || 0)));
  }

  const legacyFocus = [entry.dw1FocusQuality, entry.dw2FocusQuality].filter(
    (value): value is number => typeof value === 'number' && value > 0
  );
  if (legacyFocus.length > 0) return Math.round(avg(legacyFocus) * 10);
  if ((entry.deepWorkScore || 0) > 0) return Math.round((entry.deepWorkScore || 0) * 10);
  return 0;
}

export function getOutputSignal(entry: DailyEntry) {
  if ((entry.outputScore || 0) > 0) return Math.round((entry.outputScore || 0) * 10);
  if ((entry.productionScore || 0) > 0) return Math.round((entry.productionScore || 0) * 10);
  return calculateScore(entry).score;
}

export function getTrendState(
  weeklyTrend: 'improving' | 'declining' | 'stable' | null,
  predictionTrend: 'RISING' | 'STABLE' | 'FALLING'
) {
  if (weeklyTrend === 'improving' || predictionTrend === 'RISING') {
    return { label: 'UP', note: 'Momentum strengthening across recent sessions.' };
  }
  if (weeklyTrend === 'declining' || predictionTrend === 'FALLING') {
    return { label: 'DECLINE', note: 'Performance drift detected. Baseline correction needed.' };
  }
  return { label: 'STABLE', note: 'System output is holding steady.' };
}

export function getRiskState(
  verdict: string | null,
  predictionTrend: 'RISING' | 'STABLE' | 'FALLING',
  latestScore: number
) {
  if (verdict === 'UNDERPERFORMED' || verdict === 'DECLINING' || predictionTrend === 'FALLING' || latestScore < 55) {
    return { label: 'RISK ELEVATED', tone: 'rgba(255,150,150,0.88)' };
  }
  if (verdict === 'UNSTABLE') {
    return { label: 'WATCH VOLATILITY', tone: 'rgba(255,212,138,0.88)' };
  }
  return { label: 'STABILITY HIGH', tone: 'rgba(166,228,188,0.88)' };
}

export function buildPatternMemory(
  entries: DailyEntry[],
  insights: CausalInsight[],
  weeklyIssue: string | null,
  generated: string[]
) {
  const memory: string[] = [];

  const laggedSleep = insights.find(insight => insight.cause === 'sleep' && insight.lag === 1);
  if (laggedSleep) {
    memory.push(`Low sleep -> ${formatSignalLabel(laggedSleep.effect)} shifts after ${laggedSleep.lag + 1} days`);
  }

  const sleepAvg = avg(entries.slice(-7).map(entry => entry.totalSleepHours || 0));
  const deepWorkDays = entries.filter(entry => getFocusSignal(entry) >= 70);
  if (sleepAvg > 0 && deepWorkDays.length >= 2) {
    memory.push(`Deep work holds better when sleep stays above ${sleepAvg.toFixed(1)}h`);
  }

  if (weeklyIssue) {
    memory.push(`${weeklyIssue} has become the dominant weekly drag`);
  }

  generated.forEach(text => {
    if (memory.length < 3) memory.push(text);
  });

  return memory.slice(0, 3);
}
