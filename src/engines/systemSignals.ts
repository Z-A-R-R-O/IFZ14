import type { DailyEntry } from '../types';
import { calculateScore, calculateScoreBreakdown, calculateSubScores } from './scoreEngine';
import { getDeepWorkFocus } from './dwExtractors';

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function getSystemScoreSignal(entry: DailyEntry): number {
  return calculateScore(entry).score;
}

export function getExecutionSignal(entry: DailyEntry): number {
  return calculateScoreBreakdown(entry).execution;
}

export function getConditionSignal(entry: DailyEntry): number {
  return calculateScoreBreakdown(entry).condition;
}

export function getIntegritySignal(entry: DailyEntry): number {
  return calculateScoreBreakdown(entry).integrity;
}

export function getDeepWorkSignal(entry: DailyEntry): number {
  return Math.max(0, Math.min(100, Math.round(getDeepWorkFocus(entry) * 10)));
}

export function getDeepWorkMinutes(entry: DailyEntry): number {
  const sessions = entry.dynamic_values?.dwSessions;
  if (Array.isArray(sessions) && sessions.length > 0) {
    return sessions.reduce((sum: number, session: any) => sum + (session.duration || 0), 0);
  }

  const legacySessionCount = [
    entry.dw1FocusQuality,
    entry.dw2FocusQuality,
  ].filter((value): value is number => typeof value === 'number' && value > 0).length;

  return legacySessionCount * 60;
}

export function hasBodyRoutineConfigured(entry: DailyEntry): boolean {
  if (entry.structure_snapshot?.some((block) => block.type === 'body')) return true;
  if (Object.keys(entry.dynamic_values?.bodyHabits || {}).length > 0) return true;
  if (entry.gymTraining === 'completed' || entry.gymTraining === 'partial' || entry.gymTraining === 'skipped' || entry.gymTraining === 'none') return true;
  if (entry.jawlineWorkout) return true;
  if (hasPositiveNumber(entry.gymIntensity) || hasPositiveNumber(entry.energyAfterGym)) return true;
  return false;
}

export function getBodySignal(entry: DailyEntry): number {
  return calculateSubScores(entry).physicalScore;
}

export function hasCompletedBodyRoutine(entry: DailyEntry, threshold = 60): boolean {
  if (!hasBodyRoutineConfigured(entry)) return false;
  return getBodySignal(entry) >= threshold;
}

export function getProductionSignal(entry: DailyEntry): number {
  const productionScore = calculateSubScores(entry).productionScore;
  if (productionScore > 0) return productionScore;

  const directOutput = Math.max(entry.outputScore || 0, entry.goalProgress || 0);
  return Math.max(0, Math.min(100, Math.round(directOutput * 10)));
}
