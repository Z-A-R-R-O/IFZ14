import type { BodyHabit, DailyEntry, DayBlock, ReflectionData, ScoreResult, SystemState, Task } from '../types';

/**
 * Adaptive Score Engine
 *
 * Principles:
 * - No input -> 0
 * - Fully honored structure -> can reach 100
 * - Score adapts to the actual day structure and active body habits
 * - Missing optional groups do not hard-zero the day; weights redistribute
 */

const BLOCK_WEIGHTS: Record<DayBlock['type'], number> = {
  wake: 0.14,
  body: 0.18,
  deep_work: 0.34,
  production: 0.2,
  reflection: 0.14,
  custom: 0.14,
};

const GROUP_WEIGHTS = {
  execution: 0.55,
  condition: 0.2,
  integrity: 0.25,
} as const;

type CompletionUnit = {
  score: number;
  active: boolean;
};

type BlockEvaluation = {
  block: DayBlock;
  completion: number;
};

export interface ScoreComputationOptions {
  tasks?: Task[];
  bodyHabits?: BodyHabit[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function sleepQuality(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 4) return clamp((hours / 4) * 0.35, 0, 0.35);
  if (hours < 6) return 0.35 + ((hours - 4) / 2) * 0.3;
  if (hours <= 8) return 0.65 + ((hours - 6) / 2) * 0.35;
  if (hours <= 9) return 1;
  if (hours <= 10.5) return 1 - ((hours - 9) / 1.5) * 0.12;
  return 0.88;
}

function weightedAverage(parts: Array<{ score: number; weight: number; active?: boolean }>): CompletionUnit {
  let totalWeight = 0;
  let earned = 0;

  parts.forEach((part) => {
    if (part.active === false) return;
    totalWeight += part.weight;
    earned += clamp(part.score, 0, 1) * part.weight;
  });

  if (totalWeight <= 0) return { score: 0, active: false };
  return { score: clamp(earned / totalWeight, 0, 1), active: true };
}

function normalizeToPercent(unit: CompletionUnit): number {
  if (!unit.active) return 0;
  return clamp(Math.round(unit.score * 100), 0, 100);
}

function normalizeBodyHabitType(value: unknown): BodyHabit['type'] {
  if (typeof value === 'boolean') return 'toggle';
  if (typeof value === 'number') return 'rating';
  return 'duration';
}

function resolveTasks(options?: ScoreComputationOptions): Task[] {
  return options?.tasks ?? [];
}

function inferBodyHabits(entry: DailyEntry): BodyHabit[] {
  return Object.entries(entry.dynamic_values?.bodyHabits || {}).map(([id, value], index) => ({
    id,
    name: id,
    type: normalizeBodyHabitType(value),
    icon: '',
    isActive: true,
    order: index,
  }));
}

function resolveBodyHabits(entry: DailyEntry, options?: ScoreComputationOptions): BodyHabit[] {
  const configured = options?.bodyHabits?.filter((habit) => habit.isActive).sort((left, right) => left.order - right.order);
  if (configured && configured.length > 0) return configured;
  return inferBodyHabits(entry);
}

function getDeepWorkSessions(entry: DailyEntry) {
  const sessions = entry.dynamic_values?.dwSessions;
  if (Array.isArray(sessions) && sessions.length > 0) return sessions;

  const legacySessions = [
    {
      id: 'legacy-dw-1',
      taskTitle: entry.dw1ActualTask || entry.dw1PlannedTask || '',
      focus: (entry.dw1FocusQuality || 0) * 10,
      duration: 60,
      status: (entry.dw1FocusQuality || 0) >= 4 ? 'done' : 'pending',
    },
    {
      id: 'legacy-dw-2',
      taskTitle: entry.dw2PrimaryTask || '',
      focus: (entry.dw2FocusQuality || 0) * 10,
      duration: 60,
      status: (entry.dw2FocusQuality || 0) >= 4 ? 'done' : 'pending',
    },
  ];

  const hasLegacyEvidence = legacySessions.some((session) => (session.focus || 0) > 0 || hasText(session.taskTitle));
  return hasLegacyEvidence ? legacySessions : [];
}

function inferStructure(entry: DailyEntry): DayBlock[] {
  const blocks: DayBlock[] = [];

  const hasWake = hasText(entry.actualWakeTime) || entry.sunlightExposure || entry.hydration || (entry.morningDistraction || 0) > 0;
  const hasBodyLegacy =
    entry.gymTraining === 'completed' ||
    entry.gymTraining === 'partial' ||
    entry.gymTraining === 'skipped' ||
    entry.gymTraining === 'none' ||
    entry.jawlineWorkout ||
    hasPositiveNumber(entry.gymIntensity) ||
    hasPositiveNumber(entry.energyAfterGym);
  const hasBodyHabits = Object.keys(entry.dynamic_values?.bodyHabits || {}).length > 0;
  const deepSessions = getDeepWorkSessions(entry);
  const hasProduction = hasText(entry.productionOutput) || hasPositiveNumber(entry.outputScore) || hasPositiveNumber(entry.goalProgress);
  const hasReflection = Object.keys((entry.dynamic_values?.reflection as ReflectionData | undefined) || {}).length > 0;
  const customEntries = Object.keys(entry.dynamic_values?.custom || {});

  if (hasWake) blocks.push({ id: 'legacy-wake', type: 'wake', title: 'WAKE SYSTEM' });
  if (hasBodyLegacy || hasBodyHabits) blocks.push({ id: 'legacy-body', type: 'body', title: 'BODY SYSTEM' });
  if (deepSessions.length > 0) blocks.push({ id: 'legacy-dw', type: 'deep_work', title: 'DEEP WORK', dwCount: Math.max(2, deepSessions.length) });
  if (hasProduction) blocks.push({ id: 'legacy-production', type: 'production', title: 'PRODUCTION' });
  if (hasReflection) blocks.push({ id: 'legacy-reflection', type: 'reflection', title: 'REFLECTION' });

  customEntries.forEach((key) => {
    blocks.push({ id: key, type: 'custom', title: key.toUpperCase(), customType: 'number' });
  });

  return blocks;
}

function resolveStructure(entry: DailyEntry): DayBlock[] {
  if (Array.isArray(entry.structure_snapshot) && entry.structure_snapshot.length > 0) {
    return entry.structure_snapshot;
  }
  return inferStructure(entry);
}

export function hasScoreEvidence(entry: DailyEntry): boolean {
  if ((entry.totalSleepHours ?? 0) > 0) return true;
  if ((entry.efficiencyRating ?? entry.energyLevel ?? 0) > 0) return true;
  if ((entry.recoveryScore ?? 0) > 0 || (entry.mentalResetQuality ?? 0) > 0) return true;
  if (Object.keys(entry.dynamic_values?.reflection || {}).length > 0) return true;
  if (Object.keys(entry.dynamic_values?.custom || {}).length > 0) return true;
  if (Object.keys(entry.dynamic_values?.bodyHabits || {}).length > 0) return true;
  if (inferStructure(entry).length > 0) return true;

  const domains = [
    entry.domainBody,
    entry.domainMind,
    entry.domainIntelligence,
    entry.domainSkills,
    entry.domainProduct,
    entry.domainMoney,
    entry.domainSocial,
    entry.domainEnvironment,
  ];

  return domains.some((value) => typeof value === 'number' && value > 0);
}

function evaluateWakeBlock(entry: DailyEntry): number {
  const wakeEvidence = hasText(entry.actualWakeTime) || entry.sunlightExposure || entry.hydration || (entry.morningDistraction || 0) > 0;
  if (!wakeEvidence) return 0;

  return weightedAverage([
    { score: hasText(entry.actualWakeTime) ? 1 : 0, weight: 0.25 },
    { score: entry.sunlightExposure ? 1 : 0, weight: 0.25 },
    { score: entry.hydration ? 1 : 0, weight: 0.25 },
    { score: 1 - clamp((entry.morningDistraction || 2) / 2, 0, 1), weight: 0.25 },
  ]).score;
}

function evaluateDynamicBodyBlock(entry: DailyEntry, options?: ScoreComputationOptions): CompletionUnit {
  const activeHabits = resolveBodyHabits(entry, options);
  const values = entry.dynamic_values?.bodyHabits || {};
  if (activeHabits.length === 0) return { score: 0, active: false };

  const parts = activeHabits.map((habit) => {
    const value = values[habit.id];

    if (habit.type === 'toggle') {
      return { score: value === true ? 1 : 0, weight: 1 };
    }

    if (habit.type === 'rating') {
      return { score: clamp(toNumber(value) / 10, 0, 1), weight: 1 };
    }

    return { score: clamp(toNumber(value) / 30, 0, 1), weight: 1 };
  });

  return weightedAverage(parts);
}

function evaluateLegacyBodyBlock(entry: DailyEntry): CompletionUnit {
  const hasBodyEvidence =
    entry.gymTraining === 'completed' ||
    entry.gymTraining === 'partial' ||
    entry.gymTraining === 'skipped' ||
    entry.gymTraining === 'none' ||
    entry.jawlineWorkout ||
    hasPositiveNumber(entry.gymIntensity) ||
    hasPositiveNumber(entry.energyAfterGym);

  if (!hasBodyEvidence) return { score: 0, active: false };

  const statusScore =
    entry.gymTraining === 'completed'
      ? 1
      : entry.gymTraining === 'partial'
        ? 0.55
        : 0;

  return weightedAverage([
    { score: statusScore, weight: 0.6 },
    { score: entry.jawlineWorkout ? 1 : 0, weight: 0.1 },
    { score: clamp((entry.gymIntensity || 0) / 10, 0, 1), weight: 0.15, active: hasPositiveNumber(entry.gymIntensity) },
    { score: clamp((entry.energyAfterGym || 0) / 10, 0, 1), weight: 0.15, active: hasPositiveNumber(entry.energyAfterGym) },
  ]);
}

function evaluateBodyBlock(entry: DailyEntry, options?: ScoreComputationOptions): number {
  const dynamic = evaluateDynamicBodyBlock(entry, options);
  if (dynamic.active) return dynamic.score;
  return evaluateLegacyBodyBlock(entry).score;
}

function evaluateDeepWorkBlock(entry: DailyEntry, block: DayBlock, tasks: Task[]): number {
  const sessions = getDeepWorkSessions(entry);
  const plannedCount = Math.max(block.dwCount || 0, sessions.length, sessions.length > 0 ? 1 : 0);
  if (plannedCount <= 0) return 0;

  const padded = Array.from({ length: plannedCount }, (_, index) => sessions[index] || {});

  const total = padded.reduce((sum, session) => {
    const focus = clamp(toNumber((session as any).focus ?? (session as any).quality) / 100, 0, 1);
    const hasTarget = Boolean((session as any).taskId || hasText((session as any).taskTitle));
    const linkedTask = (session as any).taskId ? tasks.find((task) => task.id === (session as any).taskId) : null;
    const taskProgress = linkedTask
      ? linkedTask.completed || linkedTask.status === 'done'
        ? 1
        : clamp((linkedTask.completedTime || 0) / Math.max(linkedTask.estimatedTime, 1), 0, 1)
      : 0;
    const completedSignal = (session as any).isCompleted || (session as any).status === 'done' ? 1 : 0;

    return sum + clamp(focus * 0.75 + Number(hasTarget) * 0.1 + Math.max(taskProgress, completedSignal) * 0.15, 0, 1);
  }, 0);

  return clamp(total / plannedCount, 0, 1);
}

function evaluateProductionBlock(entry: DailyEntry): number {
  const hasOutputText = hasText(entry.productionOutput);
  const hasOutputScore = hasPositiveNumber(entry.outputScore);
  const hasGoalProgress = hasPositiveNumber(entry.goalProgress);
  const hasProductionType = Array.isArray(entry.productionType) && entry.productionType.length > 0;

  if (!hasOutputText && !hasOutputScore && !hasGoalProgress && !hasProductionType) return 0;

  const score = weightedAverage([
    { score: hasOutputText ? 1 : hasProductionType ? 0.65 : 0, weight: 0.4 },
    { score: clamp((entry.outputScore || 0) / 10, 0, 1), weight: 0.4 },
    { score: clamp((entry.goalProgress || 0) / 10, 0, 1), weight: 0.2, active: hasGoalProgress },
  ]);

  return score.score;
}

function hasReflectionValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) return true;
  return false;
}

function evaluateReflectionBlock(entry: DailyEntry): number {
  const reflection = entry.dynamic_values?.reflection as ReflectionData | undefined;
  if (!reflection || Object.keys(reflection).length === 0) return 0;

  const structure = resolveStructure(entry);
  const hasDeepWork = structure.some((block) => block.type === 'deep_work');
  const hasBody = structure.some((block) => block.type === 'body');

  const coreKeys = ['tasks', 'energy'];
  if (hasDeepWork) coreKeys.unshift('deepWork');
  if (hasBody) coreKeys.push('body');

  const coreAnswered = coreKeys.filter((key) => hasReflectionValue((reflection as Record<string, unknown>)[key])).length;
  const optionalKeys = [
    'deepWorkFailure',
    'energyDropReason',
    'followUpReason',
    'note',
    'planAdherence',
    'primaryObstacle',
    'disciplineScore',
    'biggestWin',
    'wouldChange',
    'tomorrowNonNegotiable',
  ];
  const optionalAnswered = optionalKeys.filter((key) => hasReflectionValue((reflection as Record<string, unknown>)[key])).length;

  const coreScore = coreKeys.length > 0 ? coreAnswered / coreKeys.length : 0;
  const depthBonus = Math.min(optionalAnswered, 2) * 0.1;

  return clamp(coreScore * 0.8 + depthBonus, 0, 1);
}

function evaluateCustomBlock(entry: DailyEntry, block: DayBlock): number {
  const value = entry.dynamic_values?.custom?.[block.id];
  if (value == null || value === '') return 0;

  if (block.customType === 'toggle') return String(value).toLowerCase() === 'true' || String(value) === '1' ? 1 : 0;
  if (block.customType === 'text') return hasText(value) ? 1 : 0;
  return clamp(toNumber(value) / 10, 0, 1);
}

function evaluateBlockCompletion(entry: DailyEntry, block: DayBlock, tasks: Task[], options?: ScoreComputationOptions): number {
  switch (block.type) {
    case 'wake':
      return evaluateWakeBlock(entry);
    case 'body':
      return evaluateBodyBlock(entry, options);
    case 'deep_work':
      return evaluateDeepWorkBlock(entry, block, tasks);
    case 'production':
      return evaluateProductionBlock(entry);
    case 'reflection':
      return evaluateReflectionBlock(entry);
    case 'custom':
      return evaluateCustomBlock(entry, block);
    default:
      return 0;
  }
}

function getBlockEvaluations(entry: DailyEntry, tasks: Task[], options?: ScoreComputationOptions): BlockEvaluation[] {
  return resolveStructure(entry).map((block) => ({
    block,
    completion: clamp(evaluateBlockCompletion(entry, block, tasks, options), 0, 1),
  }));
}

function getDomainAverage(entry: DailyEntry): CompletionUnit {
  const values = [
    entry.domainBody,
    entry.domainMind,
    entry.domainIntelligence,
    entry.domainSkills,
    entry.domainProduct,
    entry.domainMoney,
    entry.domainSocial,
    entry.domainEnvironment,
  ].filter((value): value is number => typeof value === 'number' && value > 0);

  if (values.length === 0) return { score: 0, active: false };
  return { score: clamp(values.reduce((sum, value) => sum + value, 0) / (values.length * 10), 0, 1), active: true };
}

function getRelevantTasks(entry: DailyEntry, tasks: Task[]): Task[] {
  const date = entry.date;
  const sessionIds = new Set(getDeepWorkSessions(entry).map((session: any) => session.taskId).filter(Boolean));

  const relevant = tasks.filter((task) => {
    if (sessionIds.has(task.id)) return true;
    if (task.completedAt?.startsWith(date)) return true;
    if (task.createdAt?.startsWith(date) && (task.priority === 'HIGH' || task.priority === 'MED')) return true;
    return false;
  });

  return relevant.filter((task, index, array) => array.findIndex((item) => item.id === task.id) === index);
}

export function calcExecution(entry: DailyEntry, options: ScoreComputationOptions = {}): number {
  const resolvedTasks = resolveTasks(options);
  const blockEvaluations = getBlockEvaluations(entry, resolvedTasks, options);
  const domain = getDomainAverage(entry);

  const weightedBlocks = blockEvaluations.map(({ block, completion }) => ({
    score: completion,
    weight: (BLOCK_WEIGHTS[block.type] || BLOCK_WEIGHTS.custom) * (block.weight ?? 1),
  }));

  if (domain.active) {
    weightedBlocks.push({ score: domain.score, weight: 0.08 });
  }

  return normalizeToPercent(weightedAverage(weightedBlocks));
}

export function calcCondition(entry: DailyEntry): number {
  const sleep = entry.totalSleepHours ?? 0;
  const efficiency = entry.efficiencyRating ?? entry.energyLevel ?? 0;
  const recovery = entry.recoveryScore ?? 0;
  const reset = entry.mentalResetQuality ?? 0;

  return normalizeToPercent(weightedAverage([
    { score: sleepQuality(sleep), weight: 0.45, active: sleep > 0 },
    { score: clamp(efficiency / 10, 0, 1), weight: 0.35, active: efficiency > 0 },
    { score: clamp(recovery / 10, 0, 1), weight: 0.1, active: recovery > 0 },
    { score: clamp(reset / 10, 0, 1), weight: 0.1, active: reset > 0 },
  ]));
}

export function calcIntegrity(entry: DailyEntry, options: ScoreComputationOptions = {}): number {
  const resolvedTasks = resolveTasks(options);
  const blockEvaluations = getBlockEvaluations(entry, resolvedTasks, options);
  const relevantTasks = getRelevantTasks(entry, resolvedTasks);
  const reflection = entry.dynamic_values?.reflection as ReflectionData | undefined;

  const planCompletion = weightedAverage(
    blockEvaluations.map(({ block, completion }) => ({
      score: completion >= 0.7 ? 1 : completion >= 0.4 ? 0.55 : completion,
      weight: (BLOCK_WEIGHTS[block.type] || BLOCK_WEIGHTS.custom) * (block.weight ?? 1),
    }))
  );

  const taskCommitment = weightedAverage(
    relevantTasks.map((task) => ({
      score: task.completed || task.status === 'done'
        ? 1
        : clamp((task.completedTime || 0) / Math.max(task.estimatedTime, 1), 0, 1),
      weight: task.priority === 'HIGH' ? 1.2 : task.priority === 'MED' ? 1 : 0.8,
    }))
  );

  const reflectionCompletion = weightedAverage([
    {
      score: evaluateReflectionBlock(entry),
      weight: 1,
      active: blockEvaluations.some(({ block }) => block.type === 'reflection') || Boolean(reflection),
    },
  ]);

  const base = weightedAverage([
    { score: planCompletion.score, weight: 0.5, active: planCompletion.active },
    { score: taskCommitment.score, weight: 0.3, active: taskCommitment.active },
    { score: reflectionCompletion.score, weight: 0.2, active: reflectionCompletion.active },
  ]);

  if (!base.active) return 0;

  let integrity = base.score;

  if (reflection?.planAdherence === 'FULLY') integrity += 0.08;
  if (reflection?.planAdherence === 'MOSTLY') integrity += 0.03;
  if (reflection?.planAdherence === 'PARTIALLY') integrity -= 0.05;
  if (reflection?.planAdherence === 'NOT_AT_ALL') integrity -= 0.15;

  if (typeof reflection?.disciplineScore === 'number') {
    integrity += (clamp(reflection.disciplineScore, 0, 10) / 10 - 0.5) * 0.16;
  }

  const obstacle = reflection?.primaryObstacle || reflection?.deepWorkFailure;
  if (obstacle === 'DISTRACTION' || obstacle === 'PROCRASTINATION') integrity -= 0.08;
  if (obstacle === 'OVERLOAD') integrity -= 0.04;
  if (obstacle === 'EXTERNAL_INTERRUPTION') integrity -= 0.02;
  if (obstacle === 'NONE') integrity += 0.04;

  return clamp(Math.round(clamp(integrity, 0, 1) * 100), 0, 100);
}

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

export function calculateScore(entry: DailyEntry, options: ScoreComputationOptions = {}): ScoreResult {
  const execution = calcExecution(entry, options);
  const condition = calcCondition(entry);
  const integrity = calcIntegrity(entry, options);

  const composite = weightedAverage([
    { score: execution / 100, weight: GROUP_WEIGHTS.execution, active: execution > 0 || resolveStructure(entry).length > 0 },
    { score: condition / 100, weight: GROUP_WEIGHTS.condition, active: condition > 0 },
    { score: integrity / 100, weight: GROUP_WEIGHTS.integrity, active: integrity > 0 || resolveStructure(entry).length > 0 },
  ]);

  const score = composite.active ? clamp(Math.round(composite.score * 100), 0, 100) : 0;
  return { score, state: getState(score) };
}

export function calculateScoreBreakdown(entry: DailyEntry, options: ScoreComputationOptions = {}): ScoreBreakdown {
  const execution = calcExecution(entry, options);
  const condition = calcCondition(entry);
  const integrity = calcIntegrity(entry, options);
  const { score, state } = calculateScore(entry, options);

  return {
    execution,
    condition,
    integrity,
    systemScore: score,
    state,
  };
}

export function calculateSubScores(entry: DailyEntry, options: ScoreComputationOptions = {}) {
  const resolvedTasks = resolveTasks(options);
  const blockEvaluations = getBlockEvaluations(entry, resolvedTasks, options);
  const breakdown = calculateScoreBreakdown(entry, options);

  const getBlockPercent = (type: DayBlock['type']) => {
    const blocks = blockEvaluations.filter((item) => item.block.type === type);
    if (blocks.length === 0) return 0;
    return Math.round((blocks.reduce((sum, item) => sum + item.completion, 0) / blocks.length) * 100);
  };

  return {
    deepWorkScore: getBlockPercent('deep_work'),
    physicalScore: getBlockPercent('body'),
    learningScore: getBlockPercent('custom'),
    productionScore: getBlockPercent('production'),
    executionScore: breakdown.execution,
    conditionScore: breakdown.condition,
    integrityScore: breakdown.integrity,
  };
}
