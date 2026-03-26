import type { DailyEntry, Suggestion, StreakData } from '../types';
import { calculateScore } from './scoreEngine';
import { getDeepWorkFocus } from './dwExtractors';
import { getBodySignal, hasBodyRoutineConfigured } from './systemSignals';

/**
 * Calculates Pearson correlation coefficient between two numeric arrays.
 * Returns a value between -1 and 1.
 */
function calculateCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) return 0;
  
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  
  const sumSqX = xs.reduce((a, b) => a + b * b, 0);
  const sumSqY = ys.reduce((a, b) => a + b * b, 0);
  
  const sumProd = xs.reduce((a, b, i) => a + b * ys[i], 0);
  
  const numerator = n * sumProd - sumX * sumY;
  const denominator = Math.sqrt((n * sumSqX - sumX * sumX) * (n * sumSqY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculates statistical confidence based on Sample Size vs Correlation Variance
 */
function calculateConfidence(sampleSize: number, correlationAbs: number): 'High' | 'Medium' | 'Low' {
  const score = sampleSize * correlationAbs;
  if (score > 6.0) return 'High';
  if (score > 2.5) return 'Medium';
  return 'Low';
}

export function generateSuggestions(entries: DailyEntry[], streaks: StreakData): Suggestion[] {
  const completed = entries.filter((e) => e.completed).sort((a, b) => b.date.localeCompare(a.date)); // descending
  const suggestions: Suggestion[] = [];
  
  // Need at least 3 days for base stability
  if (completed.length < 3) return [];

  // Data extraction for correlations
  const scores = completed.map(e => calculateScore(e).score);
  const sleepHours = completed.map(e => e.totalSleepHours || 0);
  const deepWorkFocus = completed.map(e => getDeepWorkFocus(e));
  
  const wakeHours = completed.map(e => {
    if (!e.wakeTime) return 7;
    const [h, m] = e.wakeTime.split(':').map(Number);
    return h + (m || 0) / 60;
  });

  // ─── 1. Sleep Correlation ───
  const sleepCorrelation = calculateCorrelation(sleepHours, scores);
  const sleepConfidence = calculateConfidence(completed.length, Math.abs(sleepCorrelation));
  const recentSleep = sleepHours.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, sleepHours.length);
  
  // STABILITY FILTER
  if (sleepCorrelation > 0.25 && recentSleep < 6.5 && sleepConfidence !== 'Low') {
    const impactPercent = Math.min(Math.round(sleepCorrelation * 100), 45);
    suggestions.push({
      id: 'sleep_optimization',
      message: 'Prioritize sleep recovery. It strongly drives your System Score.',
      impact: impactPercent,
      priority: 'high',
      confidence: sleepConfidence,
      causalPath: 'Increase Sleep → Elevate baseline energy → Score Boost',
      actionType: 'switch_template',
      actionPayload: { systemType: 'recovery' }
    });
  }

  // ─── 2. Gym / Body Consistency ───
  const trackedBodyEntries = completed.filter(hasBodyRoutineConfigured);
  const recentBody = trackedBodyEntries.slice(0, 5).filter(e => getBodySignal(e) >= 60).length;
  const bodyVals = completed.map(e => hasBodyRoutineConfigured(e) ? getBodySignal(e) / 100 : 0);
  const bodyCorr = calculateCorrelation(bodyVals, scores);
  const bodyConf = calculateConfidence(completed.length, Math.abs(bodyCorr || 0.3)); // assume baseline if 0 variance
  const estimatedBodyImpact = bodyCorr > 0 ? Math.round(bodyCorr * 100) : 15;
  
  if (recentBody === 0 && bodyConf !== 'Low') {
    suggestions.push({
      id: 'body_momentum',
      message: 'Restore body-system momentum. Physical compliance is no longer supporting your score.',
      impact: estimatedBodyImpact,
      priority: streaks.gym === 0 ? 'high' : 'medium',
      confidence: bodyConf,
      causalPath: 'Add Body Block → Restore Physical Baseline → Momentum ↑',
      actionType: 'add_block',
      actionPayload: { blockType: 'body' }
    });
  }

  // ─── 3. Negative Detection: Late Waking ───
  const wakeCorrelation = calculateCorrelation(wakeHours, scores); 
  const wakeConfidence = calculateConfidence(completed.length, Math.abs(wakeCorrelation));
  const recentWake = wakeHours.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, wakeHours.length);
  const expectedWake = wakeHours.reduce((a, b) => a + b, 0) / wakeHours.length;
  
  // If wakeCorrelation is < -0.3, it means higher wake hour = lower score (Negative impact)
  if (wakeCorrelation < -0.25 && wakeConfidence !== 'Low' && recentWake > (expectedWake + 0.5)) {
    suggestions.push({
      id: 'fix_wake_decay',
      message: 'Late waking is physically degrading your output. Execute rollback to prior baseline.',
      impact: Math.round(Math.abs(wakeCorrelation) * 100),
      priority: 'high',
      confidence: wakeConfidence,
      causalPath: 'Late Wake → Structural Delay → Score Collapse',
      // We don't have a direct "remove" wake block since wake is core, but we can suggest a template shift
      actionType: 'switch_template',
      actionPayload: { systemType: 'domination' }
    });
  }

  // ─── 4. Focus / Cognitive Overload ───
  const recentFocus = deepWorkFocus.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, deepWorkFocus.length);
  const expectedFocus = deepWorkFocus.reduce((a, b) => a + b, 0) / deepWorkFocus.length;

  if (recentFocus < expectedFocus - 1.5 && recentFocus < 6) {
    // Cognitive decay naturally has medium/high confidence if the drop is sharp
    suggestions.push({
      id: 'focus_recovery',
      message: 'Focus quality is decaying rapidly. Add Meditation to force a cognitive reset.',
      impact: 22,
      priority: 'high',
      confidence: 'Medium',
      causalPath: 'Meditation Block → Cognitive Defreeze → Deep Work Execution ↑',
      actionType: 'add_block',
      actionPayload: { blockType: 'custom', customName: 'Meditation', customType: 'number' }
    });
  }
  
  // Sort by priority and impact (deduped naturally by distinct logic nodes)
  const priorityWeight: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };

  // ─── Phase 5: Reflection-Aware Filtering ───
  // Avoid wrong suggestions by checking structured reflection data
  const recentReflections = completed.slice(0, 5).map(e => e.dynamic_values?.reflection);
  const recentFailures = recentReflections.map(r => r?.primaryObstacle || r?.deepWorkFailure).filter(Boolean);

  const filteredSuggestions = suggestions.filter(s => {
    // If user's problem is DISTRACTION, don't suggest sleep improvements
    if (recentFailures.includes('DISTRACTION') && s.id === 'sleep_optimization') return false;
    // If user's problem is OVERLOAD, don't suggest adding more work blocks
    if (recentFailures.includes('OVERLOAD') && s.actionType === 'add_block' && s.actionPayload?.blockType !== 'custom') return false;
    return true;
  });

  return filteredSuggestions.sort((a, b) => {
    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return b.impact - a.impact;
  });
}
