import { calculateScore } from '../../engines/scoreEngine';
import {
  avg,
  analyzeFailures,
  analyzeWeeklyPerformance,
  calculateGoalImpact,
  type GoalImpact,
  type WeeklyAnalysis,
} from '../../engines/analyticsEngine';
import { generateInsights } from '../../engines/insightEngine';
import { detectPattern } from '../../engines/patternEngine';
import { calculateStreaks } from '../../engines/streakEngine';
import type { DailyEntry, FailureAnalysis, Task } from '../../types';
import { buildMemory, clamp, getDeepMinutes, getFocusSignal } from '../../features/reports/lib/archive';

export interface ReportsModelInput {
  entries: DailyEntry[];
  goals: any[];
  tasks: Task[];
}

export interface ReportTimeDistributionSegment {
  label: 'DEEP WORK' | 'LIGHT WORK' | 'IDLE';
  value: number;
  accent: string;
}

export interface ReportArchiveTimelineItem {
  date: string;
  score: number;
  state: string;
  energy: number;
  sleep: number;
  deepHours: number;
}

export interface ReportsModel {
  allEntries: DailyEntry[];
  archiveTimeline: ReportArchiveTimelineItem[];
  averageScore: number;
  baselineDays: number;
  collectedDays: number;
  completionRate: number;
  consistency: number;
  deepHours: number;
  efficiency: number;
  failures: FailureAnalysis[];
  focusStability: number;
  goalImpact: GoalImpact[];
  memoryLines: string[];
  patternMemory: string[];
  previousWindow: DailyEntry[];
  recentWindow: DailyEntry[];
  riskLabel: 'RISING' | 'VARIABLE' | 'CONTROLLED';
  timeDistribution: ReportTimeDistributionSegment[];
  totalTrackedMinutes: number;
  trend: ReturnType<typeof detectPattern>;
  weekly: WeeklyAnalysis;
}

export function buildReportsModel({ entries, goals, tasks }: ReportsModelInput): ReportsModel {
  const allEntries = [...entries]
    .filter(entry => entry.completed)
    .sort((left, right) => left.date.localeCompare(right.date));

  const collectedDays = allEntries.length;
  const baselineDays = 3;
  const recentWindow = allEntries.slice(-7);
  const previousWindow = allEntries.slice(-14, -7);
  const recentScores = recentWindow.map(entry => calculateScore(entry).score);
  const deepMinutes = recentWindow.map(getDeepMinutes);
  const focusSignals = recentWindow.map(getFocusSignal).filter(value => value > 0);
  const trend = detectPattern(allEntries);
  const streaks = calculateStreaks(allEntries);
  const insightLines = generateInsights(allEntries).map(insight => insight.text);
  const failures = analyzeFailures(recentWindow);
  const weekly = analyzeWeeklyPerformance(recentWindow, previousWindow, failures);
  const goalImpact = calculateGoalImpact(goals, tasks, recentWindow, previousWindow).slice(0, 4);

  const consistency = (() => {
    if (recentScores.length < 2) return collectedDays >= baselineDays ? 100 : 0;
    const diffs = recentScores.slice(1).map((score, index) => Math.abs(score - recentScores[index]));
    return clamp(Math.round(100 - avg(diffs) * 3.4), 0, 100);
  })();

  const riskLabel = (() => {
    const criticalDays = recentScores.filter(score => score < 45).length;
    if (criticalDays >= 2 || trend.trend === 'DECLINING') return 'RISING';
    if (trend.trend === 'VOLATILE') return 'VARIABLE';
    return 'CONTROLLED';
  })();

  const averageScore = recentScores.length > 0 ? Math.round(avg(recentScores)) : 0;
  const deepHours = Math.round((avg(deepMinutes) / 60) * 10) / 10;
  const lightMinutes = (() => {
    const recentDates = new Set(recentWindow.map(entry => entry.date));
    const recentTasks = tasks.filter(task => task.completedAt && recentDates.has(task.completedAt.slice(0, 10)));
    return recentTasks
      .filter(task => task.energyType !== 'deep')
      .reduce((sum, task) => sum + (task.completedTime || task.estimatedTime || 0), 0);
  })();

  const activeMinutes = deepMinutes.reduce((sum, value) => sum + value, 0) + lightMinutes;
  const idleMinutes = clamp(recentWindow.length * 16 * 60 - activeMinutes, 0, recentWindow.length * 16 * 60);
  const totalTrackedMinutes = Math.max(activeMinutes + idleMinutes, 1);
  const timeDistribution: ReportTimeDistributionSegment[] = [
    { label: 'DEEP WORK', value: deepMinutes.reduce((sum, value) => sum + value, 0), accent: 'rgba(168, 219, 188, 0.88)' },
    { label: 'LIGHT WORK', value: lightMinutes, accent: 'rgba(255,255,255,0.82)' },
    { label: 'IDLE', value: idleMinutes, accent: 'rgba(255,255,255,0.38)' },
  ];

  const completionRate = (() => {
    const recentDates = new Set(recentWindow.map(entry => entry.date));
    const created = tasks.filter(task => recentDates.has(task.createdAt.slice(0, 10))).length;
    const completed = tasks.filter(task => task.completedAt && recentDates.has(task.completedAt.slice(0, 10))).length;
    if (created === 0 && completed === 0) return 0;
    return clamp(Math.round((completed / Math.max(created, completed, 1)) * 100), 0, 100);
  })();

  const efficiency = focusSignals.length > 0 ? Math.round(avg(focusSignals)) : 0;
  const focusStability =
    focusSignals.length > 1
      ? clamp(Math.round(100 - avg(focusSignals.slice(1).map((value, index) => Math.abs(value - focusSignals[index])))), 0, 100)
      : 0;

  const patternMemory = [trend.description.replace(/[^\x20-\x7E]/g, ''), ...insightLines.slice(0, 3)]
    .filter(Boolean)
    .slice(0, 4);

  const memoryLines = buildMemory(allEntries, streaks);
  const archiveTimeline: ReportArchiveTimelineItem[] = recentWindow.slice(-7).map(entry => {
    const { score, state } = calculateScore(entry);
    return {
      date: entry.date,
      score,
      state,
      energy: entry.efficiencyRating ?? entry.energyLevel ?? 0,
      sleep: entry.totalSleepHours || 0,
      deepHours: Math.round((getDeepMinutes(entry) / 60) * 10) / 10,
    };
  });

  return {
    allEntries,
    archiveTimeline,
    averageScore,
    baselineDays,
    collectedDays,
    completionRate,
    consistency,
    deepHours,
    efficiency,
    failures,
    focusStability,
    goalImpact,
    memoryLines,
    patternMemory,
    previousWindow,
    recentWindow,
    riskLabel,
    timeDistribution,
    totalTrackedMinutes,
    trend,
    weekly,
  };
}
