import type { Task, DailyEntry } from '../types';

/**
 * Task Engine — Phase 6: Smart Task Analytics
 * 
 * Analyzes task patterns to surface high-impact tasks,
 * detect neglected items, and identify overestimation trends.
 */

export interface TaskAnalysis {
  highImpactTasks: Task[];
  neglectedTasks: Task[];
  overestimatedTasks: Task[];
  completionRate: number;       // 0-1
  avgTimePerTask: number;       // minutes
  deepWorkUtilization: number;  // 0-1 ratio of deep tasks completed vs created
}

export function analyzeTasks(tasks: Task[], _entries: DailyEntry[]): TaskAnalysis {
  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed && t.status !== 'skipped');

  // Completion rate
  const completionRate = tasks.length > 0 ? completed.length / tasks.length : 0;

  // Average time per task
  const avgTimePerTask = completed.length > 0
    ? completed.reduce((sum, t) => sum + (t.estimatedTime || 30), 0) / completed.length
    : 30;

  // High impact tasks = HIGH priority + deep energy + pending
  const highImpactTasks = pending
    .filter(t => t.priority === 'HIGH' && t.energyType === 'deep')
    .sort((a, b) => (b.scoreImpact?.expected || 0) - (a.scoreImpact?.expected || 0));

  // Neglected tasks = pending for > 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const neglectedTasks = pending.filter(t => new Date(t.createdAt).getTime() < threeDaysAgo);

  // Overestimated tasks = completed tasks with estimatedTime > 90 that were split
  const overestimatedTasks = tasks.filter(t =>
    t.estimatedTime > 90 && !t.subtaskIds?.length && t.status !== 'done'
  );

  // Deep work utilization
  const deepCreated = tasks.filter(t => t.energyType === 'deep').length;
  const deepCompleted = tasks.filter(t => t.energyType === 'deep' && t.completed).length;
  const deepWorkUtilization = deepCreated > 0 ? deepCompleted / deepCreated : 0;

  return {
    highImpactTasks,
    neglectedTasks,
    overestimatedTasks,
    completionRate,
    avgTimePerTask,
    deepWorkUtilization,
  };
}

/**
 * Assigns HIGH priority tasks to deep work sessions for Auto-Day.
 * Returns tasks sorted by priority and matched to available session slots.
 */
export function assignTasksToSessions(
  tasks: Task[],
  sessionCount: number
): Task[] {
  const eligible = tasks
    .filter(t => !t.completed && t.energyType === 'deep' && t.status !== 'skipped')
    .sort((a, b) => {
      const pMap: Record<string, number> = { HIGH: 0, MED: 1, LOW: 2 };
      if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority];
      return (b.scoreImpact?.expected || 0) - (a.scoreImpact?.expected || 0);
    });

  return eligible.slice(0, sessionCount);
}

/**
 * Generates smart task insights for the Tasks page.
 */
export function generateTaskInsights(tasks: Task[]): string[] {
  const insights: string[] = [];
  const pending = tasks.filter(t => !t.completed && t.status !== 'skipped');
  const highPending = pending.filter(t => t.priority === 'HIGH');

  if (highPending.length > 3) {
    insights.push(`${highPending.length} HIGH tasks pending — consider splitting or reprioritizing.`);
  }

  const deepPending = pending.filter(t => t.energyType === 'deep');
  const totalDeepTime = deepPending.reduce((s, t) => s + (t.estimatedTime || 30), 0);
  if (totalDeepTime > 240) {
    insights.push(`${Math.round(totalDeepTime / 60)}h of deep work queued — system may overload.`);
  }

  const neglected = pending.filter(t => {
    const age = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age > 5;
  });
  if (neglected.length > 0) {
    insights.push(`${neglected.length} task${neglected.length > 1 ? 's' : ''} older than 5 days — reassess or remove.`);
  }

  return insights;
}
