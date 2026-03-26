import { DailyEntry, DayTemplate, Task } from '../types';
import { CausalInsight, FailureAnalysis, PerformanceDriver, CausalChain, PredictiveState } from '../types';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { computeAllGoals } from './goalEngine';
import { calculateScore, calculateScoreBreakdown } from './scoreEngine';
import { createEmptyEntry } from '../types';

// ─── UTILS ───
export function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = avg(x), my = avg(y);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

export function normalize01(v: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function stabilityFactor(series: number[]): number {
  // penalize noisy signals
  const mean = avg(series);
  if (series.length === 0) return 0;
  const variance = avg(series.map(x => (x - mean) ** 2));
  return 1 / (1 + Math.sqrt(variance)); // 0–1
}

export function lagCorrelation(x: number[], y: number[], lag: 0 | 1 = 0): number {
  // lag=1 means x[t] vs y[t+1]
  if (x.length <= lag || y.length <= lag) return 0;
  const X = x.slice(0, x.length - lag);
  const Y = y.slice(lag);
  return pearson(X, Y);
}

export function getConfidence({
  r,              // correlation
  n,              // sample size
  stability,      // 0–1
  repetition      // 0–1
}: {
  r: number; n: number; stability: number; repetition: number;
}): number {
  const size = Math.min(1, n / 10);
  return Math.abs(r) * 0.5 + stability * 0.2 + repetition * 0.2 + size * 0.1;
}

export function impactFromR(r: number): number {
  // map -1..1 → -30..+30 roughly
  return Math.round(r * 30);
}

function getEntryScore(entry: DailyEntry): number {
  return calculateScore(entry).score;
}

function getEntryIntegrity(entry: DailyEntry): number {
  return calculateScoreBreakdown(entry).integrity;
}

function getDeepWorkVolume(entry: DailyEntry): number {
  if (entry.dynamic_values?.dwSessions) {
    return entry.dynamic_values.dwSessions.reduce((acc: number, s: any) => acc + (s.duration || 60) * ((s.focus || s.quality || 0) / 100), 0);
  }
  return (entry.dynamic_values?.dwQualities || []).reduce((acc: number, q: number) => acc + q, 0);
}

// ─── 0. LIMITED ANALYSIS (2-4 Days) ───
export function limitedAnalysis(entries: DailyEntry[]): CausalInsight[] {
  if (entries.length < 2) return [];

  // Simple math for limited days
  const score = entries.map(getEntryScore);
  const deepWorkVol = entries.map(getDeepWorkVolume);

  const normScore = score.map(v => normalize01(v, 40, 100));
  const normDW = deepWorkVol.map(v => normalize01(v, 0, 300));

  const r = lagCorrelation(normDW, normScore, 0);
  if (r > 0.1) {
    return [{
      cause: 'deepWork',
      effect: 'score',
      lag: 0,
      impact: Math.round(r * 20),
      confidence: 0.2, // Hardcoded LOW
      type: 'boost'
    }];
  }

  return [];
}

// ─── 1. CAUSATION ENGINE ───
export function detectCausation(entries: DailyEntry[]): CausalInsight[] {
  const MIN_DAYS = 5;
  if (entries.length < MIN_DAYS) return limitedAnalysis(entries);

  // Extract raw series directly from entries
  // Fill missing with averages or 0 to keep alignment
  const score = entries.map(getEntryScore);
  const energy = entries.map(e => e.efficiencyRating ?? e.energyLevel ?? 0);
  const sleep = entries.map(e => e.totalSleepHours || 7);
  
  // Custom series
  const deepWorkVol = entries.map(getDeepWorkVolume);
  
  const distraction = entries.map(e => {
    const reflections = e.dynamic_values?.reflection;
    if (!reflections) return 0;
    
    // Convert legacy 0|1|2 to roughly 0-10 or use new taskFailure counting
    let count = e.dw1Interruptions || 0;
    if (reflections.deepWorkFailure === 'DISTRACTION') count += 5;
    return count;
  });
  
  const integrity = entries.map(getEntryIntegrity);

  // Normalize mapping
  const normScore = score.map(v => normalize01(v, 40, 100));
  const normEnergy = energy.map(v => normalize01(v, 0, 10));
  const normSleep = sleep.map(v => normalize01(v, 4, 10)); // 4h to 10h
  const normDW = deepWorkVol.map(v => normalize01(v, 0, 300)); // up to 300 "volume" points
  
  const pairs = [
    { cause: 'sleep', effect: 'score',         x: normSleep,  y: normScore,   rawY: score },
    { cause: 'energy', effect: 'deepWork',     x: normEnergy, y: normDW,      rawY: deepWorkVol },
    { cause: 'deepWork', effect: 'score',      x: normDW,     y: normScore,   rawY: score },
    { cause: 'distraction', effect: 'score',   x: distraction.map(v => normalize01(v, 0, 10)), y: normScore, rawY: score },
    { cause: 'distraction', effect: 'deepWork',x: distraction.map(v => normalize01(v, 0, 10)), y: normDW,    rawY: deepWorkVol },
    { cause: 'overload', effect: 'integrity',  x: distraction.map(v => normalize01(v, 0, 10)), y: integrity.map(v => normalize01(v, 40, 100)), rawY: integrity }
  ];

  const insights: CausalInsight[] = [];
  
  pairs.forEach(pair => {
    // Test lags
    const r0 = lagCorrelation(pair.x, pair.y, 0);
    const r1 = lagCorrelation(pair.x, pair.y, 1);
    
    let bestR = 0;
    let bestLag: 0 | 1 = 0;
    
    if (Math.abs(r1) > Math.abs(r0)) {
      bestR = r1;
      bestLag = 1;
    } else {
      bestR = r0;
      bestLag = 0;
    }

    // Filters
    const stab = stabilityFactor(pair.x);
    // Repetition check: how many times did X and Y move in the same direction?
    let repCount = 0;
    for (let i = 1; i < pair.x.length - bestLag; i++) {
        const dx = pair.x[i] - pair.x[i-1];
        const dy = pair.y[i+bestLag] - pair.y[i-1+bestLag];
        // If correlation is positive, they should move together. If negative, opposite.
        if (bestR > 0 && dx * dy > 0) repCount++;
        else if (bestR < 0 && dx * dy < 0) repCount++;
    }
    const repetition = pair.x.length > 1 ? repCount / (pair.x.length - 1 - bestLag) : 0;

    let conf = getConfidence({
      r: bestR, 
      n: pair.x.length, 
      stability: stab, 
      repetition
    });

    // Run pure math confidence through the self-correcting memory loop
    const insightKey = `${pair.cause}→${pair.effect}|lag${bestLag}`;
    conf = useAnalyticsStore.getState().getAdjustedConfidence(insightKey, conf);

    // Hard filters
    if (conf >= 0.45 && Math.abs(bestR) >= 0.25) {
      const type = bestR > 0 ? 'boost' : 'harm';
      // Invert negative causes if "distraction" lowers score, we know it's harm
      // Specifically: distracting is bad, if it reduces score (r < 0), distraction impact is negative
      insights.push({
        cause: pair.cause,
        effect: pair.effect,
        lag: bestLag,
        impact: impactFromR(bestR),
        confidence: conf,
        type: (pair.cause === 'distraction' && bestR > 0) ? 'harm' : type 
      });
    }
  });

  return insights.sort((a, b) => b.confidence - a.confidence);
}

// ─── 2. DRIVERS ───
export function getTopDrivers(entries: DailyEntry[]): PerformanceDriver[] {
  const insights = detectCausation(entries);
  
  // Aggregate drivers
  const drivers: Record<string, number> = {};
  insights.forEach(ins => {
    // Only care about effect on score or integrity for global drivers
    if (ins.effect === 'score' || ins.effect === 'integrity') {
      drivers[ins.cause] = (drivers[ins.cause] || 0) + ins.impact;
    }
  });

  return Object.entries(drivers)
    .map(([factor, impact]) => ({ factor, impact }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

// ─── 3. FAILURE ANALYSIS ───
export function analyzeFailures(entries: DailyEntry[]): FailureAnalysis[] {
  if (entries.length < 3) return [];

  // Parse reflection data to find most reported failure modes
  const failures: Record<string, { count: number, scoreDrop: number }> = {};
  
  let validDays = 0;
  entries.forEach(e => {
    const score = getEntryScore(e);
    if (!e.dynamic_values?.reflection || score <= 0) return;
    const ref = e.dynamic_values.reflection;
    validDays++;
    
      // Look at causes of drop
      const dropCause = ref.deepWorkFailure || (e.dw1Interruptions && e.dw1Interruptions > 1 ? 'DISTRACTION' : null);
      if (dropCause) {
        if (!failures[dropCause]) failures[dropCause] = { count: 0, scoreDrop: 0 };
        failures[dropCause].count += 1;
        
        // Calculate score drop from baseline (assume baseline 80 if dropping)
        const drop = Math.min(0, score - 80);
      failures[dropCause].scoreDrop += drop;
    }
  });

  if (validDays === 0) return [];

  return Object.entries(failures)
    .map(([cause, data]) => ({
      topFailure: cause.toUpperCase(),
      frequency: data.count / validDays,
      impact: Math.round(data.scoreDrop / data.count) || -10
    }))
    .sort((a, b) => a.impact - b.impact); // sort by worst impact
}

// ─── 4. PREDICTION ───
export function predictOutcome(
  todayEntry: Partial<DailyEntry>, 
  plannedTasks: Task[]
): PredictiveState {
  const date = todayEntry.date || new Date().toISOString().slice(0, 10);
  const base = createEmptyEntry(date, todayEntry.structure_snapshot);

  const deepTasks = plannedTasks.filter(task => !task.completed && task.energyType === 'deep');
  const highPriority = plannedTasks.filter(task => !task.completed && task.priority === 'HIGH');

  const inferredStructure: DayTemplate = todayEntry.structure_snapshot && todayEntry.structure_snapshot.length > 0
    ? todayEntry.structure_snapshot
    : [
        { id: 'wake-predict', type: 'wake', title: 'WAKE SYSTEM' },
        ...(deepTasks.length > 0 ? [{ id: 'dw-predict', type: 'deep_work', title: 'DEEP WORK', dwCount: Math.min(Math.max(deepTasks.length, 1), 4) } as const] : []),
        ...(highPriority.length > 0 ? [{ id: 'prod-predict', type: 'production', title: 'PRODUCTION' } as const] : []),
      ];

  const predictedEntry: DailyEntry = {
    ...base,
    ...todayEntry,
    structure_snapshot: inferredStructure,
    dynamic_values: {
      ...(base.dynamic_values || {}),
      ...(todayEntry.dynamic_values || {}),
      dwSessions: deepTasks.slice(0, Math.min(Math.max(deepTasks.length, 1), 4)).map((task) => ({
        id: `predict-${task.id}`,
        taskId: task.id,
        taskTitle: task.title,
        duration: Math.max(30, Math.min(task.estimatedTime || 60, 120)),
        focus: clamp(55 + (todayEntry.efficiencyRating ?? todayEntry.energyLevel ?? 5) * 4, 35, 90),
        status: 'pending',
      })),
    },
    outputScore: highPriority.length > 0 ? 6 : todayEntry.outputScore || 0,
    goalProgress: highPriority.length > 0 ? 6 : todayEntry.goalProgress || 0,
  };

  const expectedScore = calculateScore(predictedEntry, { tasks: plannedTasks }).score;
  
  let trend: 'RISING' | 'STABLE' | 'FALLING' = 'STABLE';
  if (expectedScore > 80) trend = 'RISING';
  else if (expectedScore < 60) trend = 'FALLING';

  return {
    expectedScore: Math.round(expectedScore),
    trend
  };
}

// ─── 5. ACTIONS ───
export function generateActions(insights: CausalInsight[], failures: FailureAnalysis[]): string[] {
  const actions: string[] = [];

  // Negative drivers first
  const topHarm = insights.find(i => i.type === 'harm');
  if (topHarm) {
    if (topHarm.cause === 'distraction') actions.push("Eliminate distraction to protect deep work");
    else if (topHarm.cause === 'sleep') actions.push(`Sleep earlier (prevents ${topHarm.impact}% score plunge)`);
    else actions.push(`Watch out for ${topHarm.cause} drops`);
  }

  // Failures
  if (failures.length > 0 && failures[0].frequency > 0.3) {
    if (failures[0].topFailure.includes('OVERLOAD')) {
      actions.push("Reduce to 2 deep work sessions (burnout detected)");
    } else {
      actions.push(`Solve ${failures[0].topFailure.toLowerCase()} blocker (failing ${Math.round(failures[0].frequency * 100)}% of days)`);
    }
  }

  // Positive drivers
  const topBoost = insights.find(i => i.type === 'boost');
  if (topBoost) {
    if (topBoost.cause === 'sleep') actions.push(`Prioritize sleep (+${topBoost.impact}%)`);
    else if (topBoost.cause === 'deepWork') actions.push(`Focus on hitting 2 deep work sessions minimum`);
  }
  
  // Fallback (Day 1 - Minimal)
  if (actions.length === 0) {
    actions.push("Focus on 2 deep work sessions");
    actions.push("Improve sleep consistency");
    actions.push("Complete your highest priority task early");
  }

  return [...new Set(actions)].slice(0, 3); // Max 3 unique actions
}

// ─── 5.5 NEXT WEEK STRATEGY ───
export interface StrategyPlan {
  focus: string[];
  avoid: string[];
  systemPath: string;
}

export function generateStrategy(
  insights: CausalInsight[], 
  failures: FailureAnalysis[],
  mode: WeeklyAnalysis['mode'],
  deepWorkAvg: number,
  sleepAvg: number
): StrategyPlan {
  const focus: Set<string> = new Set();
  const avoid: Set<string> = new Set();
  
  if (sleepAvg < 6) focus.add(`Fix sleep (target 6h+)`);
  if (deepWorkAvg < 60) focus.add(`Secure 1 daily deep work session (60m)`);

  const topHarm = insights.find(i => i.type === 'harm');
  if (topHarm && topHarm.impact < -10) {
    if (topHarm.cause === 'distraction') avoid.add(`Context switching during deep blocks`);
    else if (topHarm.cause === 'sleep') avoid.add(`Late night wakefulness disrupting baseline`);
    else avoid.add(`Allowing ${topHarm.cause} to destabilize execution`);
  }

  if (failures.length > 0) {
    const f = failures[0].topFailure;
    if (f.includes('OVERLOAD') || f.includes('PROCRASTINATION')) {
      focus.add(`Reduce daily task load by 30%`);
      avoid.add(`Over-planning tasks`);
    } else if (f.includes('DISTRACTION')) {
      avoid.add(`Unprotected deep work environments`);
    }
  }

  // Backfill if empty
  if (focus.size === 0) focus.add(`Maintain execution consistency`);
  if (focus.size < 2 && deepWorkAvg >= 60) focus.add(`Maintain 2 deep work sessions/day`);
  if (avoid.size === 0) avoid.add(`Deviation from baseline schedule`);

  let systemPath = 'MAINTENANCE → LEVERAGE';
  if (mode === 'RECOVERY') systemPath = 'RECOVERY → STABILIZE → PUSH';
  if (mode === 'DOMINATION') systemPath = 'DOMINATION → SCALE → ACCELERATE';

  return {
    focus: Array.from(focus).slice(0, 3),
    avoid: Array.from(avoid).slice(0, 2),
    systemPath
  };
}

// ─── 6. CAUSAL CHAINS ───
export function buildCausalChains(insights: CausalInsight[]): CausalChain[] {
  const chains: CausalChain[] = [];
  
  // Looking for A -> B -> C
  const sleepToEnergy = insights.find(i => i.cause === 'sleep' && i.effect === 'energy');
  const energyToDeepWork = insights.find(i => i.cause === 'energy' && i.effect === 'deepWork');
  const deepWorkToScore = insights.find(i => i.cause === 'deepWork' && i.effect === 'score');

  if (sleepToEnergy && energyToDeepWork && deepWorkToScore) {
    chains.push(['sleep', 'energy', 'deepWork', 'score']);
  } else if (energyToDeepWork && deepWorkToScore) {
    chains.push(['energy', 'deepWork', 'score']);
  } else if (sleepToEnergy && sleepToEnergy.effect === 'score') {
    chains.push(['sleep', 'score']);
  }

  return chains;
}

// ─── 7. WEEKLY VERDICT ENGINE ───
export interface WeeklyAnalysis {
  verdict: 'UNDERPERFORMED' | 'DECLINING' | 'UNSTABLE' | 'OPTIMAL';
  mode: 'RECOVERY' | 'MAINTENANCE' | 'DOMINATION';
  primaryIssue: string | null;
  trend: 'improving' | 'declining' | 'stable';
}

export function analyzeWeeklyPerformance(
  currentWeek: DailyEntry[], 
  previousWeek: DailyEntry[], 
  failures: FailureAnalysis[]
): WeeklyAnalysis {
  const currentScores = currentWeek.map(getEntryScore);
  const previousScores = previousWeek.map(getEntryScore);
  
  const currentAvg = avg(currentScores);
  const prevAvg = avg(previousScores);
  
  const currentVariance = stdDev(currentScores);
  
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (currentAvg > prevAvg + 3) trend = 'improving';
  else if (currentAvg < prevAvg - 3) trend = 'declining';

  // 1. Verdict Logic
  let verdict: WeeklyAnalysis['verdict'] = 'OPTIMAL';
  if (currentAvg < 60) {
    verdict = 'UNDERPERFORMED';
  } else if (trend === 'declining' && currentVariance > 10) {
    verdict = 'DECLINING';
  } else if (currentVariance > 15) {
    verdict = 'UNSTABLE';
  }

  // 2. System Mode
  const sleepAvg = avg(currentWeek.map(e => e.totalSleepHours || 0));
  const energyAvg = avg(currentWeek.map(e => e.efficiencyRating ?? e.energyLevel ?? 0));
  
  // Custom DW logic
  const dwVol = currentWeek.map(getDeepWorkVolume);
  const dwAvg = avg(dwVol);

  let mode: WeeklyAnalysis['mode'] = 'MAINTENANCE';
  if (sleepAvg < 6 && energyAvg < 5) {
    mode = 'RECOVERY';
  } else if (dwAvg > 120 && energyAvg >= 6 && currentVariance < 12) {
    // Over 2 hours of DW average and stable energy
    mode = 'DOMINATION';
  }

  // 3. Primary Issue
  let primaryIssue = failures.length > 0 ? failures[0].topFailure : null;
  // Make it title case for UI
  if (primaryIssue) {
    primaryIssue = primaryIssue.charAt(0).toUpperCase() + primaryIssue.slice(1).toLowerCase();
  } else if (verdict === 'UNDERPERFORMED') {
     if (sleepAvg < 5.5) primaryIssue = 'Critical Sleep Deficit';
     else if (dwAvg < 40) primaryIssue = 'Deep Work Inconsistency';
     else primaryIssue = 'Execution Baseline Failure';
  }

  return { verdict, mode, primaryIssue, trend };
}

// ─── 8. GOAL IMPACT NORMALIZATION ───
export interface GoalImpact {
  goalId: string;
  title: string;
  progressPercent: number;
  progressDelta: number;
  contributionDelta: number;
}

export function calculateGoalImpact(
  goals: any[],
  tasks: Task[],
  currEntries: DailyEntry[],
  prevEntries: DailyEntry[]
): GoalImpact[] {
  const currStats = computeAllGoals(goals, tasks, currEntries);
  const prevStats = computeAllGoals(goals, tasks, prevEntries);

  const impacts: GoalImpact[] = [];

  goals.forEach(goal => {
    const prev = prevStats[goal.id];
    const curr = currStats[goal.id];
    if (!curr) return;

    let progressDelta = curr.progress - (prev ? prev.progress : 0);
    // Normalize contribution logic: find tasks linked to THIS goal exclusively?
    // Since goalEngine assigns impact directly, we'll bound it by the max delta.
    let contributionDelta = curr.contributionScore - (prev ? prev.contributionScore : 0);
    
    // Safety clamp (prevent inflation)
    if (contributionDelta > 40) contributionDelta = 40;

    impacts.push({
      goalId: goal.id,
      title: goal.title,
      progressPercent: curr.progress,
      progressDelta: Math.max(0, Math.min(100, Math.round(progressDelta))),
      contributionDelta: Math.round(contributionDelta)
    });
  });

  return impacts.sort((a,b) => b.contributionDelta - a.contributionDelta);
}

// ─── 9. EXPORT GENERATION ───
export function generateWeeklyReport(
  entries: DailyEntry[],
  goals: any[],
  tasks: Task[]
): string {
  if (entries.length < 7) {
    return 'IFZ14 SYSTEM — INSUFFICIENT DATA\nLog at least 7 days to generate a weekly report.\n';
  }

  const currentWeek = entries.slice(-7);
  const previousWeek = entries.slice(-14, -7);

  const failures = analyzeFailures(currentWeek);
  const verdict = analyzeWeeklyPerformance(currentWeek, previousWeek, failures);
  const insights = detectCausation(entries).filter(i => i.confidence >= 0.4);
  const goalImpacts = calculateGoalImpact(goals, tasks, currentWeek, previousWeek);
  
  const currentSleep = avg(currentWeek.map(e => e.totalSleepHours || 0));
  const currentEnergy = avg(currentWeek.map(e => e.efficiencyRating ?? e.energyLevel ?? 0));
  
  const getDW = (arr: DailyEntry[]) => arr.map(getDeepWorkVolume);
  
  const currentDW = Math.round(avg(getDW(currentWeek)) / 60 * 10) / 10;
  const currentScore = Math.round(avg(currentWeek.map(getEntryScore)));

  const plan = generateStrategy(insights, failures, verdict.mode, currentDW * 60, currentSleep);

  let doc = `IFZ14 SYSTEM — WEEKLY INTELLIGENCE REPORT\n`;
  doc += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
  doc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  doc += `[ VERDICT ]\n`;
  doc += `Status: ${verdict.verdict}\n`;
  doc += `Score:  ${currentScore} (${verdict.trend})\n`;
  doc += `Mode:   ${verdict.mode}\n`;
  if (verdict.primaryIssue) doc += `Issue:  ${verdict.primaryIssue}\n`;
  doc += `\n`;

  doc += `[ METRICS (7-Day Avg) ]\n`;
  doc += `Deep Work: ${currentDW}h\n`;
  doc += `Energy:    ${currentEnergy.toFixed(1)}/10\n`;
  doc += `Sleep:     ${currentSleep.toFixed(1)}h\n`;
  doc += `\n`;

  doc += `[ ALGORITHMIC STRATEGY ]\n`;
  doc += `System Path: ${plan.systemPath}\n\n`;
  doc += `Focus:\n`;
  plan.focus.forEach(f => doc += ` → ${f}\n`);
  doc += `Avoid:\n`;
  plan.avoid.forEach(a => doc += ` → ${a}\n`);
  doc += `\n`;

  if (goalImpacts.length > 0) {
    doc += `[ GOAL IMPACT ]\n`;
    goalImpacts.forEach(g => {
      doc += `${g.title}: +${g.progressDelta}% progress (+${g.contributionDelta} pts)\n`;
    });
    doc += `\n`;
  }

  return doc;
}

