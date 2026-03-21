import type { DailyEntry, ScoreResult, SystemState, ReflectionData, Task } from '../types';

/**
 * Score Engine — Phase 5: The Truth Scoring Engine
 * 
 * SystemScore = Execution × 0.5  +  Condition × 0.2  +  Integrity × 0.3
 * 
 * Execution  = objective task completion (deep work, gym, production, custom blocks)
 * Condition  = contextual state (sleep, energy)
 * Integrity  = alignment between plan and reality, adjusted by structured reflection
 */

// ─── Utility ───

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Legacy Block Scorers (still used by Execution layer) ───

function getWakeScore(entry: DailyEntry): number {
  let score = 0;
  if (entry.sunlightExposure) score += 3;
  if (entry.hydration) score += 3;
  score += (2 - (entry.morningDistraction || 0)) * 2;
  return score;
}

function getBodyScore(entry: DailyEntry): number {
  let score = 0;
  if (entry.gymTraining === 'completed') score += 4;
  else if (entry.gymTraining === 'partial') score += 2;
  if (entry.jawlineWorkout) score += 1;
  score += ((entry.gymIntensity || 0) / 10) * 3;
  score += ((entry.energyAfterGym || 0) / 10) * 2;
  return Math.min(score, 10);
}

function getDeepWorkScore(entry: DailyEntry, tasks: Task[]): number {
  if (entry.structure_snapshot?.length) {
    const dwBlock = entry.structure_snapshot.find(b => b.type === 'deep_work');
    const count = dwBlock?.dwCount || 2;
    const sessions = entry.dynamic_values?.dwSessions || [];
    let executionSum = 0;

    for (let i = 0; i < count; i++) {
        const session = sessions[i];
        if (!session) continue;
        const focus = session.focus || session.quality || 0;
        
        if (session.taskId && tasks.length > 0) {
            const task = tasks.find((t: Task) => t.id === session.taskId);
            if (task) {
                const duration = session.duration || 60;
                // execution += (session.focus / 100) * (session.duration / task.estimatedTime) -> capped logically
                const ratio = Math.min(duration / Math.max(task.estimatedTime, 1), 1);
                executionSum += (focus / 100) * ratio * 10; 
                // multiplied by 10 to match block scale bounds inside calcExecution (0-10 max logic)
            } else {
                executionSum += focus / 10;
            }
        } else {
             executionSum += focus / 10;
        }
    }
    return count > 0 ? executionSum / count : 0;
  }
  // Legacy fallback
  const dw1 = (entry.dw1FocusQuality || 0) * 0.5 + (2 - (entry.dw1Interruptions || 0)) * 1.5;
  const dw2 = (entry.dw2FocusQuality || 0) * 0.5;
  return Math.min((dw1 + dw2) / 2 + 2, 10);
}

function getProductionScore(entry: DailyEntry): number {
  return ((entry.outputScore || 0) + (entry.goalProgress || 0)) / 2;
}

function getCustomBlockScore(entry: DailyEntry): number {
  if (!entry.structure_snapshot || !entry.dynamic_values?.custom) return 0;
  const customBlocks = entry.structure_snapshot.filter(b => b.type === 'custom');
  if (customBlocks.length === 0) return 0;

  let total = 0;
  customBlocks.forEach(block => {
    const val = entry.dynamic_values?.custom?.[block.id];
    if (typeof val === 'number') total += clamp(val, 0, 10);
    else if (typeof val === 'boolean') total += val ? 10 : 0;
    else if (val) total += 10;
  });
  return total / customBlocks.length;
}

function getDomainAverage(entry: DailyEntry): number {
  const domains = [
    entry.domainBody || 0, entry.domainMind || 0, entry.domainIntelligence || 0,
    entry.domainSkills || 0, entry.domainProduct || 0, entry.domainMoney || 0,
    entry.domainSocial || 0, entry.domainEnvironment || 0,
  ];
  return domains.reduce((a, b) => a + b, 0) / domains.length;
}

// ═══════════════════════════════════════
//  LAYER 1: EXECUTION SCORE (50%)
//  What you objectively DID today
// ═══════════════════════════════════════

export function calcExecution(entry: DailyEntry, tasks: Task[] = []): number {
  if (entry.structure_snapshot?.length) {
    // Dynamic block-weighted scoring
    const weights: Record<string, number> = {
      wake: 10, body: 15, deep_work: 25, production: 20, reflection: 5, custom: 5,
    };

    let totalWeight = 0;
    let earned = 0;

    entry.structure_snapshot.forEach(block => {
      let blockScore = 0;
      const w = (weights[block.type] || 5) * (block.weight ?? 1);

      switch (block.type) {
        case 'wake': blockScore = getWakeScore(entry); break;
        case 'body': blockScore = getBodyScore(entry); break;
        case 'deep_work': blockScore = getDeepWorkScore(entry, tasks); break;
        case 'production': blockScore = getProductionScore(entry); break;
        case 'custom': blockScore = getCustomBlockScore(entry); break;
        case 'reflection': {
          const ref = entry.dynamic_values?.reflection;
          blockScore = ref ? (ref.deepWork || ref.note ? 10 : 5) : 0;
          break;
        }
      }
      earned += (blockScore / 10) * w;
      totalWeight += w;
    });

    // Domain passive
    earned += (getDomainAverage(entry) / 10) * 15;
    totalWeight += 15;

    return totalWeight > 0 ? clamp(Math.round((earned / totalWeight) * 100), 0, 100) : 0;
  }

  // Legacy fallback
  const metrics = [
    { v: getWakeScore(entry), w: 0.10, m: 10 },
    { v: getBodyScore(entry), w: 0.15, m: 10 },
    { v: getDeepWorkScore(entry, tasks), w: 0.25, m: 10 },
    { v: getProductionScore(entry), w: 0.20, m: 10 },
    { v: getDomainAverage(entry), w: 0.15, m: 10 },
  ];
  return clamp(Math.round(metrics.reduce((s, m) => s + (m.v / m.m) * m.w * 100, 0)), 0, 100);
}

// ═══════════════════════════════════════
//  LAYER 2: CONDITION SCORE (20%)
//  The state you were IN today
// ═══════════════════════════════════════

export function calcCondition(entry: DailyEntry, _tasks: Task[] = []): number {
  const sleep = entry.totalSleepHours || 0;
  const energy = entry.energyLevel || 5;

  const sleepScore = clamp((sleep / 8) * 100, 0, 100);
  const energyScore = (energy / 10) * 100;

  return clamp(Math.round(0.6 * sleepScore + 0.4 * energyScore), 0, 100);
}

// ═══════════════════════════════════════
//  LAYER 3: INTEGRITY SCORE (30%)
//  How aligned were you with your plan?
//  *** THIS IS WHERE REFLECTION MATTERS ***
// ═══════════════════════════════════════

export function calcIntegrity(entry: DailyEntry, tasks: Task[] = []): number {
  const reflection = entry.dynamic_values?.reflection as ReflectionData | undefined;

  // --- Planned vs Completed deep work sessions ---
  let planned = 2; // default
  let completed = 0;

  if (entry.structure_snapshot?.length) {
    const dwBlock = entry.structure_snapshot.find(b => b.type === 'deep_work');
    planned = dwBlock?.dwCount || 2;
    const qualities = entry.dynamic_values?.dwQualities || [];
    completed = qualities.filter((q: number) => q >= 4).length; // quality >= 4/10 counts as "completed"
  } else {
    // Legacy
    if ((entry.dw1FocusQuality || 0) >= 4) completed++;
    if ((entry.dw2FocusQuality || 0) >= 4) completed++;
  }

  let base = (completed / Math.max(planned, 1)) * 100;

  // --- Gym alignment ---
  if (entry.gymTraining === 'completed') base += 5;
  else if (entry.gymTraining === 'skipped' || entry.gymTraining === 'none') base -= 5;

  // --- Task Completion / Integrity impact ---
  if (tasks.length > 0) {
    // Only check active tasks linked to today, or tasks pending
    const highTasks = tasks.filter(t => t.priority === 'HIGH' && (t.status === 'active' || t.status === 'pending'));
    highTasks.forEach(task => {
      // If task wasn't fully complete
      if (task.status !== 'done') {
         if ((task.completedTime || 0) === 0) {
            // Task never started at all
            let penalty = 20;
            if (reflection?.deepWorkFailure === 'OVERLOAD') {
               penalty *= 0.7; // Cut penalty by 30% if user acknowledges overload
            }
            base -= Math.round(penalty);
         } else if ((task.completedTime || 0) < task.estimatedTime) {
            // Task partially executed but not completely
            let penalty = 10;
            if (reflection?.deepWorkFailure === 'OVERLOAD') {
               penalty *= 0.7; // Cut penalty by 30%
            }
            base -= Math.round(penalty);
         }
      } else {
         base += 5; // Honored a HIGH task commitment
      }
    });
  }

  // --- Reflection-based penalty/bonus modifiers ---
  if (reflection?.deepWorkFailure === 'LOW_ENERGY') {
    base *= 0.9; // soften penalty — valid reason
  } else if (reflection?.deepWorkFailure === 'DISTRACTION') {
    base *= 0.8; // harsher — controllable
  } else if (reflection?.deepWorkFailure === 'OVERLOAD') {
    base *= 0.85; // system should have adapted
  } else if (reflection?.deepWorkFailure === 'NO_CLARITY') {
    base *= 0.88; // planning issue
  }

  // No reflection + poor performance = honesty penalty
  if (!reflection && completed < planned) {
    base *= 0.85;
  }

  // Honesty bonus: reflection present
  if (reflection) base += 5;

  // Legacy reflection adjustments (backward compat)
  if (reflection?.deepWork === 'All') base += 8;
  if (reflection?.deepWork === 'None') base -= 8;
  if (reflection?.tasks === 'Yes') base += 3;
  if (reflection?.tasks === 'No') base -= 3;

  return clamp(Math.round(base), 0, 100);
}

// ═══════════════════════════════════════
//  THE TRUTH SCORE
//  SystemScore = Execution × 0.5 + Condition × 0.2 + Integrity × 0.3
// ═══════════════════════════════════════

function getState(score: number): SystemState {
  if (score >= 90) return 'PEAK';
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'STABLE';
  if (score >= 35) return 'LOW';
  return 'CRITICAL';
}

export interface ScoreBreakdown {
  execution: number;
  condition: number;
  integrity: number;
  systemScore: number;
  state: SystemState;
}

export function calculateScore(entry: DailyEntry, tasks: Task[] = []): ScoreResult {
  const execution = calcExecution(entry, tasks);
  const condition = calcCondition(entry, tasks);
  const integrity = calcIntegrity(entry, tasks);

  const score = clamp(
    Math.round(execution * 0.5 + condition * 0.2 + integrity * 0.3),
    0,
    100
  );

  return { score, state: getState(score) };
}

export function calculateScoreBreakdown(entry: DailyEntry, tasks: Task[] = []): ScoreBreakdown {
  const execution = calcExecution(entry, tasks);
  const condition = calcCondition(entry, tasks);
  const integrity = calcIntegrity(entry, tasks);

  const systemScore = clamp(
    Math.round(execution * 0.5 + condition * 0.2 + integrity * 0.3),
    0,
    100
  );

  return { execution, condition, integrity, systemScore, state: getState(systemScore) };
}

/** Compute sub-scores for display map (backward compat) */
export function calculateSubScores(entry: DailyEntry, tasks: Task[] = []) {
  const breakdown = calculateScoreBreakdown(entry, tasks);
  return {
    deepWorkScore: Math.round(getDeepWorkScore(entry, tasks) * 10),
    physicalScore: Math.round(getBodyScore(entry) * 10),
    learningScore: 0,
    productionScore: Math.round(getProductionScore(entry) * 10),
    executionScore: breakdown.execution,
    conditionScore: breakdown.condition,
    integrityScore: breakdown.integrity,
  };
}
