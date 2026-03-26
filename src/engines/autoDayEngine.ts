import type {
  DailyEntry, DayType, StateAnalysis, CapacityResult, AutoDayPlan,
  DeepWorkSession, GymPlan, AutoDayPreFilled, PredictedOutcome,
  MinimumGuarantee, AdaptiveQuestion, FailureTag, DayTemplate,
  Task, Goal, GoalWithComputed,
} from '../types';
import { computeAllGoals } from './goalEngine';
import { calculateScore } from './scoreEngine';
import { detectPattern } from './patternEngine';

/**
 * Auto-Day Engine — Pure logic, no React, no stores.
 * Modular sub-builders → assembled into a final day plan.
 */

// ─── 1. STATE ANALYZER ───

export function analyzeState(
  entries: DailyEntry[],
  energyOverride?: number,
  sleepOverride?: number
): StateAnalysis {
  const recent = entries.slice(-7);
  const last3 = entries.slice(-3);

  // Deep Work Quality (avg of focus qualities across recent entries)
  const dwQualities = recent.map(e => {
    const sessions = e.dynamic_values?.dwSessions || e.dynamic_values?.dwQualities;
    if (Array.isArray(sessions)) {
      const vals = sessions.map((s: any) => typeof s === 'number' ? s : (s.quality || 0));
      return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
    }
    return ((e.dw1FocusQuality || 0) + (e.dw2FocusQuality || 0)) / 2;
  });
  const avgDeepWorkQuality = dwQualities.length > 0
    ? dwQualities.reduce((a, b) => a + b, 0) / dwQualities.length : 0;

  // Sleep
  const sleepVals = recent.map(e => e.totalSleepHours || 0).filter(v => v > 0);
  const avgSleep = sleepOverride ?? (sleepVals.length > 0
    ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : 7);

  // Energy
  const energyVals = recent.map(e => e.efficiencyRating ?? e.energyLevel ?? 0).filter(v => v > 0);
  const avgEnergy = energyOverride ?? (energyVals.length > 0
    ? energyVals.reduce((a, b) => a + b, 0) / energyVals.length : 5);

  // Gym Consistency
  const gymDays = recent.filter(e => e.gymTraining === 'completed' || e.gymTraining === 'partial').length;
  const gymConsistency = recent.length > 0 ? gymDays / recent.length : 0;

  // Score Trend
  const scores = recent.map(e => calculateScore(e).score);
  const pattern = detectPattern(entries);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;

  // Last 3 day load (avg score as proxy for workload)
  const last3Scores = last3.map(e => calculateScore(e).score);
  const last3DayLoad = last3Scores.length > 0
    ? last3Scores.reduce((a, b) => a + b, 0) / last3Scores.length : 50;

  // Deep work yesterday
  const yesterday = entries[entries.length - 1];
  const deepWorkYesterday = yesterday
    ? ((yesterday.dw1FocusQuality || 0) > 0 || (yesterday.dynamic_values?.dwQualities?.length || 0) > 0)
    : false;

  // Consecutive declines
  let consecutiveDeclines = 0;
  for (let i = scores.length - 1; i > 0; i--) {
    if (scores[i] < scores[i - 1]) consecutiveDeclines++;
    else break;
  }

  // Failure tags from recent entries
  const failureTags: FailureTag[] = [];
  if (avgEnergy < 4) failureTags.push('LOW_ENERGY');
  if (last3DayLoad > 80) failureTags.push('OVERLOAD');
  if (avgDeepWorkQuality < 3 && recent.length > 2) failureTags.push('NO_CLARITY');
  if (consecutiveDeclines >= 2 && avgEnergy >= 5) failureTags.push('DISTRACTION');

  // Data completeness
  const completedEntries = entries.filter(e => e.completed).length;
  const dataCompleteness = Math.min(completedEntries / 7, 1);

  return {
    avgDeepWorkQuality,
    avgSleep,
    avgEnergy,
    gymConsistency,
    scoreTrend: pattern.trend,
    avgScore,
    last3DayLoad,
    deepWorkYesterday,
    consecutiveDeclines,
    recentScores: scores,
    failureTags,
    dataCompleteness,
  };
}

// ─── 2. DAY TYPE CLASSIFIER ───

export function classifyDayType(
  analysis: StateAnalysis,
  energy: number,
  sleep: number
): DayType {
  // SALVAGE: bad streak / instability
  if (analysis.consecutiveDeclines >= 3 || analysis.scoreTrend === 'VOLATILE') {
    return 'SALVAGE';
  }

  // RECOVERY: low energy or burnout signals
  if (energy <= 3 || sleep < 5 || analysis.failureTags.includes('OVERLOAD')) {
    return 'RECOVERY';
  }

  // DOMINATION: high energy + stable/rising trend
  if (energy >= 7 && sleep >= 7 && (analysis.scoreTrend === 'RISING' || analysis.scoreTrend === 'STABLE')) {
    return 'DOMINATION';
  }

  // BUILD: medium energy + growth phase
  return 'BUILD';
}

// ─── 3. CAPACITY CALCULATOR ───

export function calculateCapacity(
  analysis: StateAnalysis,
  energy: number,
  sleep: number
): CapacityResult {
  // Base deep work sessions from energy + sleep
  let maxDW = 2;
  if (energy >= 8 && sleep >= 7) maxDW = 3;
  if (energy >= 6 && sleep >= 6) maxDW = 2;
  if (energy <= 4 || sleep < 5) maxDW = 1;

  // Last 3 day load adjustment
  if (analysis.last3DayLoad > 75) maxDW = Math.max(maxDW - 1, 1);

  // Expected output
  let expectedOutput = Math.round((energy / 10) * 50 + (sleep / 9) * 30 + (analysis.avgScore / 100) * 20);
  expectedOutput = Math.min(100, Math.max(10, expectedOutput));

  // Gym intensity
  let gymIntensity: CapacityResult['gymIntensity'] = 'moderate';
  if (energy >= 8 && sleep >= 7) gymIntensity = 'intense';
  if (energy <= 4 || sleep < 5) gymIntensity = 'light';
  if (energy <= 2) gymIntensity = 'rest';

  // Sleep target (smart wake time logic: based on current deficit + pattern)
  let sleepTarget = 7.5;
  if (analysis.avgSleep < 6) sleepTarget = 8.5; // sleep debt → more sleep
  if (analysis.avgSleep >= 7.5) sleepTarget = 7;

  return { maxDeepWorkSessions: maxDW, expectedOutput, gymIntensity, sleepTarget };
}

// ─── 4. RISK ADJUSTMENT ───

export function applyRiskAdjustment(
  capacity: CapacityResult,
  analysis: StateAnalysis
): CapacityResult {
  const adjusted = { ...capacity };

  // 2+ days decline → reduce overload
  if (analysis.consecutiveDeclines >= 2) {
    adjusted.maxDeepWorkSessions = Math.max(adjusted.maxDeepWorkSessions - 1, 1);
    adjusted.expectedOutput = Math.max(adjusted.expectedOutput - 15, 20);
  }

  // Failure tag: OVERLOAD → cut capacity
  if (analysis.failureTags.includes('OVERLOAD')) {
    adjusted.maxDeepWorkSessions = Math.min(adjusted.maxDeepWorkSessions, 2);
    adjusted.gymIntensity = adjusted.gymIntensity === 'intense' ? 'moderate' : adjusted.gymIntensity;
  }

  // 0 deep work yesterday → enforce minimum today
  if (!analysis.deepWorkYesterday) {
    adjusted.maxDeepWorkSessions = Math.max(adjusted.maxDeepWorkSessions, 1);
  }

  // LOW_ENERGY → force lighter load
  if (analysis.failureTags.includes('LOW_ENERGY')) {
    adjusted.gymIntensity = 'light';
    adjusted.expectedOutput = Math.min(adjusted.expectedOutput, 60);
  }

  return adjusted;
}

// ─── 5. SUB-BUILDERS ───

export function buildDeepWorkPlan(
  capacity: CapacityResult,
  tasks: Task[],
  wakeTime: string,
  sortedGoals: GoalWithComputed[]
): DeepWorkSession[] {
  const sessions: DeepWorkSession[] = [];

  const MAX_TIMELINE_HOURS = 10;

  // 1. Task Scoring (Base Priority + Goal Pressure)
  const scoredTasks = tasks
    .filter(t => !t.completed && (t.energyType === 'deep' || t.priority === 'HIGH'))
    .map(t => {
      const pOrder: Record<string, number> = { HIGH: 10, MED: 5, LOW: 2 };
      const basePriorityScore = pOrder[t.priority] || 2;
      const goal = t.goalId ? sortedGoals.find(g => g.id === t.goalId) : null;
      const normalizedPressure = goal ? Math.min(goal.pressure, 10) : 0;
      
      const taskScore = (basePriorityScore * 2) + (normalizedPressure * 3);
      return { ...t, _score: taskScore };
    })
    .sort((a, b) => b._score - a._score); // Descending

  // 2. Goal Distribution
  const topGoals = sortedGoals.filter(g => g.pressure > 0).slice(0, 2);
  let totalPressure = topGoals.reduce((sum, g) => sum + Math.min(g.pressure, 10), 0);
  
  const goalAllocations: Record<string, number> = {};
  let remainingSlots = capacity.maxDeepWorkSessions;
  
  if (totalPressure > 0 && remainingSlots > 0) {
    for (const goal of topGoals) {
      const p = Math.min(goal.pressure, 10);
      const slots = Math.round(capacity.maxDeepWorkSessions * (p / totalPressure));
      goalAllocations[goal.id] = Math.max(0, Math.min(slots, remainingSlots));
      remainingSlots -= goalAllocations[goal.id];
    }
  }

  const selectedTasks: any[] = [];
  const usedTaskIds = new Set<string>();

  // Allocate per goal
  for (const goal of topGoals) {
    const alloc = goalAllocations[goal.id] || 0;
    const goalTasks = scoredTasks.filter(t => t.goalId === goal.id && !usedTaskIds.has(t.id));
    for (let i = 0; i < alloc && i < goalTasks.length; i++) {
      selectedTasks.push(goalTasks[i]);
      usedTaskIds.add(goalTasks[i].id);
    }
  }

  // Fill remaining capacity with top remaining tasks globally
  const remainingTasks = scoredTasks.filter(t => !usedTaskIds.has(t.id));
  while (selectedTasks.length < capacity.maxDeepWorkSessions && remainingTasks.length > 0) {
    selectedTasks.push(remainingTasks.shift()!);
  }

  // Slot calculation from wake time
  const [wH, wM] = wakeTime.split(':').map(Number);
  const wakeMinutes = wH * 60 + wM;
  const maxEndMinutes = wakeMinutes + MAX_TIMELINE_HOURS * 60;

  // Time slots: morning (wake+1h), afternoon (wake+5h), night (wake+8h)
  const slotStarts = {
    morning: wakeMinutes + 60,
    afternoon: wakeMinutes + 300,
    night: wakeMinutes + 480,
  };

  // Assign tasks to best-fit slots
  let cursor = wakeMinutes + 60; // Start 1h after wake (body block)
  const ts = Date.now();
  let totalScheduled = 0;

  for (let i = 0; i < Math.min(capacity.maxDeepWorkSessions, selectedTasks.length); i++) {
    const task = selectedTasks[i];
    const duration = Math.min(task.estimatedTime || 60, 120); // Cap single session at 2h

    // Smart slot: prefer the task's preferred time if cursor hasn't passed it
    const preferred = task.preferredTime || 'morning';
    const slotStart = slotStarts[preferred as keyof typeof slotStarts];
    if (slotStart > cursor && totalScheduled + duration <= MAX_TIMELINE_HOURS * 60) {
      cursor = slotStart;
    }

    // Cap: don't exceed max timeline
    if (cursor + duration > maxEndMinutes) break;

    const breakAfter = i < capacity.maxDeepWorkSessions - 1 ? 15 : 0;
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const startTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    sessions.push({
      id: `dw-${ts + i}`,
      taskId: task.id,
      taskTitle: task.title,
      focus: 0,
      status: 'pending',
      duration,
      startTime,
      breakAfter,
      isCompleted: false,
      isLocked: false,
      autoGenerated: true,
    });

    cursor += duration + breakAfter;
    totalScheduled += duration + breakAfter;
  }

  // Fill remaining capacity with empty sessions if needed
  while (sessions.length < capacity.maxDeepWorkSessions && cursor + 60 <= maxEndMinutes) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const startTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    sessions.push({
      id: `dw-${ts + sessions.length}`,
      taskTitle: `Session ${sessions.length + 1}`,
      focus: 0,
      status: 'pending',
      duration: 60,
      startTime,
      breakAfter: 0,
      isCompleted: false,
      isLocked: false,
      autoGenerated: true,
    });

    cursor += 75; // 60m + 15m break
  }

  return sessions;
}

export function buildGymPlan(capacity: CapacityResult): GymPlan {
  const notesMap: Record<string, string> = {
    rest: 'Rest day — light stretching or walk only',
    light: 'Light session — mobility, walking, yoga',
    moderate: 'Standard training — strength + cardio mix',
    intense: 'Full intensity — push limits, compound lifts',
  };

  return {
    intensity: capacity.gymIntensity,
    notes: notesMap[capacity.gymIntensity],
  };
}

export function buildProductionPlan(capacity: CapacityResult): number {
  return capacity.expectedOutput;
}

export function buildSleepPlan(
  analysis: StateAnalysis,
  capacity: CapacityResult
): { sleepTarget: number; wakeTime: string } {
  // Smart wake time: align with past consistency
  const avgWakeMinutes = analysis.avgSleep > 0
    ? Math.round((24 - analysis.avgSleep) * 60 + 360) // rough: awake at 6 + adjustment
    : 390; // default 06:30

  // Clamp between 05:00 and 08:00
  const clampedMinutes = Math.max(300, Math.min(480, avgWakeMinutes));
  const wH = Math.floor(clampedMinutes / 60);
  const wM = clampedMinutes % 60;
  const wakeTime = `${wH.toString().padStart(2, '0')}:${wM.toString().padStart(2, '0')}`;

  return { sleepTarget: capacity.sleepTarget, wakeTime };
}

export function selectTemplate(dayType: DayType): { templateId: string; modeName: string } {
  switch (dayType) {
    case 'DOMINATION':
      return { templateId: 'domination', modeName: 'DOMINATION MODE' };
    case 'BUILD':
      return { templateId: 'execution', modeName: 'BUILD MODE' };
    case 'RECOVERY':
      return { templateId: 'recovery', modeName: 'RECOVERY MODE' };
    case 'SALVAGE':
      return { templateId: 'recovery', modeName: 'SALVAGE MODE' };
  }
}

// ─── 6. CONFIDENCE SCORE ───

export function calculateConfidence(analysis: StateAnalysis): number {
  let score = 0;

  // Data completeness (0-0.4)
  score += analysis.dataCompleteness * 0.4;

  // Consistency (low std dev in scores) (0-0.3)
  if (analysis.recentScores.length >= 3) {
    const mean = analysis.recentScores.reduce((a, b) => a + b, 0) / analysis.recentScores.length;
    const variance = analysis.recentScores.reduce((s, v) => s + (v - mean) ** 2, 0) / analysis.recentScores.length;
    const stdDev = Math.sqrt(variance);
    score += Math.max(0, 0.3 - (stdDev / 100));
  }

  // Stable/Rising trend (0-0.3)
  if (analysis.scoreTrend === 'STABLE') score += 0.2;
  if (analysis.scoreTrend === 'RISING') score += 0.3;
  if (analysis.scoreTrend === 'VOLATILE') score += 0;
  if (analysis.scoreTrend === 'DECLINING') score += 0.1;

  return Math.min(1, Math.max(0, score));
}

// ─── 7. PREDICTED OUTCOME ───

export function predictOutcome(
  analysis: StateAnalysis,
  capacity: CapacityResult,
  dayType: DayType
): PredictedOutcome {
  // Base prediction from capacity
  let expectedScore = capacity.expectedOutput;

  // Day type modifier
  if (dayType === 'DOMINATION') expectedScore = Math.min(expectedScore + 10, 95);
  if (dayType === 'RECOVERY') expectedScore = Math.max(expectedScore - 10, 30);
  if (dayType === 'SALVAGE') expectedScore = Math.max(expectedScore - 20, 20);

  // Trend prediction
  let trend: PredictedOutcome['trend'] = 'STABLE';
  if (analysis.scoreTrend === 'RISING' && expectedScore > analysis.avgScore) trend = 'RISING';
  if (analysis.scoreTrend === 'DECLINING' && analysis.consecutiveDeclines >= 2) trend = 'DECLINING';

  return { expectedScore: Math.round(expectedScore), trend };
}

// ─── 8. MINIMUM GUARANTEE ───

export function buildMinimumGuarantee(dayType: DayType): MinimumGuarantee {
  // No zero days allowed
  return {
    deepWorkSessions: dayType === 'RECOVERY' ? 0 : 1,
    gymIntensity: dayType === 'SALVAGE' ? 'rest' : 'light',
  };
}

// ─── 9. ASSEMBLER ───

export function assembleDayPlan(
  dayType: DayType,
  analysis: StateAnalysis,
  capacity: CapacityResult,
  deepWorkSessions: DeepWorkSession[],
  gymPlan: GymPlan,
  productionTarget: number,
  sleepPlan: { sleepTarget: number; wakeTime: string },
  template: DayTemplate,
  modeName: string,
  confidence: number,
  prediction: PredictedOutcome,
  minimum: MinimumGuarantee,
  energy: number,
  topPressureGoals?: (Goal & GoalWithComputed)[]
): AutoDayPlan {
  // Force reflection if decline trend or salvage day
  const forceReflection = analysis.consecutiveDeclines >= 2 || dayType === 'SALVAGE';

  // Pre-fill Custom Blocks
  const customPrefill: Record<string, string | number | boolean> = {};
  const customBlocks = template.filter(b => b.type === 'custom');
  
  customBlocks.forEach(block => {
    if (block.customType === 'toggle') customPrefill[block.id] = false;
    if (block.customType === 'number') customPrefill[block.id] = 5;
    if (block.customType === 'text') customPrefill[block.id] = '';
  });

  // Build strongly-typed preFilled
  const preFilled: AutoDayPreFilled = {
    wake: { time: sleepPlan.wakeTime, sleep: sleepPlan.sleepTarget },
    body: { gym: capacity.gymIntensity !== 'rest', energy, intensity: capacity.gymIntensity },
    deepWork: {
      sessions: deepWorkSessions,
    },
    production: { target: productionTarget },
    custom: customPrefill,
  };

  return {
    dayType,
    wakeTime: sleepPlan.wakeTime,
    sleepTarget: sleepPlan.sleepTarget,
    capacity,
    deepWorkSessions,
    gymPlan,
    productionTarget,
    forceReflection,
    confidence,
    prediction,
    minimum,
    template,
    modeName,
    preFilled,
    topPressureGoals,
  };
}

// ─── 10. MASTER GENERATOR (orchestrator) ───

export function generateDayPlan(
  entries: DailyEntry[],
  tasks: Task[],
  goals: Goal[],
  energy: number,
  sleep: number,
  templateStructures?: Record<string, DayTemplate>
): AutoDayPlan {
  // Step 1: Analyze
  const analysis = analyzeState(entries, energy, sleep);

  // Step 2: Classify
  const dayType = classifyDayType(analysis, energy, sleep);

  // Step 3: Capacity
  let capacity = calculateCapacity(analysis, energy, sleep);

  // Step 4: Risk adjust
  capacity = applyRiskAdjustment(capacity, analysis);

  // Step 5: Plan components & Goal Injection
  const goalStats = computeAllGoals(goals, tasks, entries);
  const sortedGoals = Object.values(goalStats).sort((a, b) => b.pressure - a.pressure);
  const topPressureGoals = sortedGoals.filter(g => g.pressure >= 1).slice(0, 2);

  const sleepPlan = buildSleepPlan(analysis, capacity);
  const deepWorkSessions = buildDeepWorkPlan(capacity, tasks, sleepPlan.wakeTime, sortedGoals);
  const gymPlan = buildGymPlan(capacity);
  const productionTarget = buildProductionPlan(capacity);

  // Step 6: Template
  const { templateId, modeName } = selectTemplate(dayType);
  const template = templateStructures?.[templateId] || buildDefaultTemplate(dayType, capacity);

  // Step 7: Scoring
  const confidence = calculateConfidence(analysis);
  const prediction = predictOutcome(analysis, capacity, dayType);
  const minimum = buildMinimumGuarantee(dayType);

  // Step 8: Assemble
  return assembleDayPlan(
    dayType, analysis, capacity, deepWorkSessions, gymPlan,
    productionTarget, sleepPlan, template, modeName,
    confidence, prediction, minimum, energy, topPressureGoals
  );
}

// ─── 11. ADAPTIVE QUESTIONS ───

export function determineAdaptiveQuestions(
  entries: DailyEntry[],
  analysis: StateAnalysis | null
): AdaptiveQuestion[] {
  const questions: AdaptiveQuestion[] = [];

  // Always ask energy if we can't infer it
  const recentEnergy = entries.slice(-1)[0]?.efficiencyRating ?? entries.slice(-1)[0]?.energyLevel;
  if (!recentEnergy || entries.length < 3) {
    questions.push({
      id: 'energy',
      title: "How's your energy today?",
      type: 'slider',
      min: 1,
      max: 10,
      reason: 'Energy drives capacity calculation',
    });
  }

  // Ask sleep if not logged recently
  const recentSleep = entries.slice(-1)[0]?.totalSleepHours;
  if (!recentSleep || recentSleep === 0) {
    questions.push({
      id: 'sleep',
      title: 'How many hours did you sleep?',
      type: 'slider',
      min: 0,
      max: 12,
      reason: 'Sleep quality determines day type',
    });
  }

  // If yesterday failed → ask what went wrong
  if (analysis && !analysis.deepWorkYesterday && entries.length > 0) {
    questions.push({
      id: 'yesterdayIssue',
      title: 'What went wrong yesterday?',
      type: 'select',
      options: ['Distraction', 'Low Energy', 'Overload', 'No Clarity', 'External'],
      reason: 'Failure feedback improves today\'s plan',
    });
  }

  // Focus intent — always useful
  questions.push({
    id: 'intent',
    title: 'What matters most today?',
    type: 'select',
    options: ['Deep Work', 'Recovery', 'Balanced'],
    reason: 'Priority intent shapes block distribution',
  });

  // If high-performance streak → skip optional questions
  if (analysis && analysis.scoreTrend === 'RISING' && analysis.avgScore > 70 && analysis.dataCompleteness > 0.7) {
    // Keep only the first question (energy) — system is confident
    return questions.slice(0, 1);
  }

  return questions;
}

// ─── HELPER: Default Template Builder ───

function buildDefaultTemplate(dayType: DayType, capacity: CapacityResult): DayTemplate {
  const template: DayTemplate = [];
  const ts = Date.now();

  template.push({ id: `wake-${ts}`, type: 'wake', title: 'WAKE SYSTEM' });
  template.push({ id: `body-${ts + 1}`, type: 'body', title: 'BODY SYSTEM' });

  if (dayType !== 'RECOVERY') {
    template.push({
      id: `dw-${ts + 2}`,
      type: 'deep_work',
      title: 'DEEP WORK',
      dwCount: capacity.maxDeepWorkSessions,
    });
  }

  if (dayType === 'DOMINATION' || dayType === 'BUILD') {
    template.push({ id: `prod-${ts + 3}`, type: 'production', title: 'PRODUCTION' });
  }

  if (dayType === 'RECOVERY') {
    template.push({ id: `custom-${ts + 5}`, type: 'custom', title: 'LIGHT WORK', customType: 'toggle' });
  }

  template.push({ id: `ref-${ts + 4}`, type: 'reflection', title: 'REFLECTION' });

  return template;
}
