import type { Goal, GoalComputed, GoalWithComputed, Task, DailyEntry } from '../types';

/**
 * Goal Engine — Pure intelligence functions.
 *
 * Rules:
 *  - Store = minimal (only truth data)
 *  - Engine = all derived values
 *  - NEVER write back to store from here
 */

// ─── 1. PROGRESS ───

export function calculateGoalProgress(
  goal: Goal,
  tasks: Task[],
  dailyEntries: DailyEntry[]
): { currentValue: number; progress: number } {
  let currentValue = 0;

  // Filter out any stale/deleted tasks instantly
  const validLinkedTaskIds = goal.linkedTaskIds.filter(id => tasks.some(t => t.id === id));
  const linked = tasks.filter(t => validLinkedTaskIds.includes(t.id));

  if (goal.targetType === 'task_count') {
    currentValue = linked.filter(t => t.completed).length;
  }

  if (goal.targetType === 'time') {
    if (goal.trackDeepWork) {
      // Sum deep work minutes ONLY from sessions linked to this goal's tasks
      currentValue = dailyEntries
        .filter(e => e.completed)
        .reduce((sum, entry) => {
          const sessions = entry.dynamic_values?.dwSessions || [];
          const matchedMinutes = sessions.reduce((s: number, sess: any) => {
            const focus = sess.focus || sess.quality || 0;
            // Only count if session is explicitly linked to a task in THIS goal
            if (focus >= 30 && sess.taskId && validLinkedTaskIds.includes(sess.taskId)) {
              return s + (sess.duration || 60);
            }
            return s;
          }, 0);
          return sum + matchedMinutes;
        }, 0);
    } else {
      currentValue = linked.reduce((sum, t) => sum + (t.completedTime || 0), 0);
    }
  }

  if (goal.targetType === 'milestone') {
    currentValue = goal.milestoneCompleted ? 100 : 0;
  }

  const progress = goal.targetValue > 0
    ? Math.min(Math.round((currentValue / goal.targetValue) * 100), 100)
    : 0;

  return { currentValue, progress };
}

// ─── 2. RISK ───

export function calculateRisk(
  goal: Goal,
  progress: number
): 'low' | 'medium' | 'high' {
  if (!goal.deadline) return 'low';

  // Timezone safe deadline diff
  const deadParts = goal.deadline.split('-'); // YYYY-MM-DD
  const deadlineLocal = new Date(Number(deadParts[0]), Number(deadParts[1]) - 1, Number(deadParts[2])).getTime();
  const createdLocal = new Date(goal.createdAt).getTime();
  
  const daysLeft = (deadlineLocal - Date.now()) / (1000 * 60 * 60 * 24);

  // Past deadline and not complete
  if (daysLeft <= 0 && progress < 100) return 'high';

  // Expected progress based on time elapsed
  const totalDays = (deadlineLocal - createdLocal) / (1000 * 60 * 60 * 24);
  const elapsed = totalDays - daysLeft;
  const expectedProgress = totalDays > 0 ? (elapsed / totalDays) * 100 : 100;

  if (progress < expectedProgress - 20) return 'high';
  if (progress < expectedProgress - 5) return 'medium';

  return 'low';
}

// ─── 3. REQUIRED PACE ───

export function calculateRequiredPace(
  goal: Goal,
  currentValue: number
): number | null {
  if (!goal.deadline || goal.targetType === 'milestone') return null;

  const remaining = goal.targetValue - currentValue;
  if (remaining <= 0) return 0;

  const deadParts = goal.deadline.split('-');
  const deadlineLocal = new Date(Number(deadParts[0]), Number(deadParts[1]) - 1, Number(deadParts[2])).getTime();
  const daysLeft = (deadlineLocal - Date.now()) / (1000 * 60 * 60 * 24);
  
  if (daysLeft <= 0) return null;

  return Math.round((remaining / daysLeft) * 10) / 10;
}

// ─── 4. CONTRIBUTION ───

export function calculateContribution(goal: Goal, tasks: Task[]): number {
  const linkedCompleted = tasks.filter(
    t => goal.linkedTaskIds.includes(t.id) && t.completed
  );

  return linkedCompleted.reduce((sum, t) => {
    return sum + (t.scoreImpact?.expected || 5);
  }, 0);
}

// ─── 4.5. PRESSURE ───

export function calculateGoalPressure(
  goal: Goal,
  currentValue: number,
  tasks: Task[]
): number {
  if (!goal.deadline || goal.targetType === 'milestone') return 0;

  const remainingWork = goal.targetValue - currentValue;
  if (remainingWork <= 0) return 0;

  const now = new Date();
  const deadParts = goal.deadline.split('-');
  const deadline = new Date(Number(deadParts[0]), Number(deadParts[1]) - 1, Number(deadParts[2]));

  const daysLeft = (deadline.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 0) return 100; // max urgency

  const base = remainingWork / daysLeft;

  // Non-linear urgency boost
  const urgencyMultiplier = daysLeft <= 3 ? 2 : daysLeft <= 7 ? 1.5 : 1;
  let pressure = base * urgencyMultiplier;

  // Stagnation Boost (2+ days with no progress)
  const validLinkedTaskIds = goal.linkedTaskIds.filter(id => tasks.some(t => t.id === id));
  const linked = tasks.filter(t => validLinkedTaskIds.includes(t.id));
  const completedLinked = linked.filter(t => t.completed && t.completedAt);
  
  const latestCompletionStr = completedLinked.reduce((max, t) => (t.completedAt! > max ? t.completedAt! : max), '');
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  
  let isStagnant = false;
  if (latestCompletionStr) {
    if (Date.now() - new Date(latestCompletionStr).getTime() > twoDaysMs) isStagnant = true;
  } else if (Date.now() - new Date(goal.createdAt).getTime() > twoDaysMs) {
    isStagnant = true;
  }

  if (isStagnant) pressure *= 1.3;

  return Math.round(pressure * 10) / 10;
}

// ─── 5. FULL COMPUTE (single goal) ───

export function computeGoal(
  goal: Goal,
  tasks: Task[],
  dailyEntries: DailyEntry[]
): GoalComputed {
  const { currentValue, progress } = calculateGoalProgress(goal, tasks, dailyEntries);
  const riskLevel = calculateRisk(goal, progress);
  const requiredPace = calculateRequiredPace(goal, currentValue);
  const contributionScore = calculateContribution(goal, tasks);
  const pressure = calculateGoalPressure(goal, currentValue, tasks);

  return { currentValue, progress, contributionScore, riskLevel, requiredPace, pressure };
}

export function computeAllGoals(
  goals: Goal[],
  tasks: Task[],
  dailyEntries: DailyEntry[]
): Record<string, GoalWithComputed> {
  const map: Record<string, GoalWithComputed> = {};
  for (const goal of goals) {
    map[goal.id] = { ...goal, ...computeGoal(goal, tasks, dailyEntries) };
  }
  return map;
}

// ─── 6. INSIGHTS ───

export function generateGoalInsights(
  goals: Goal[],
  tasks: Task[],
  dailyEntries: DailyEntry[]
): string[] {
  const insights: string[] = [];

  goals.forEach(goal => {
    const { progress } = calculateGoalProgress(goal, tasks, dailyEntries);
    const risk = calculateRisk(goal, progress);

    if (risk === 'high') {
      insights.push(`⚠ "${goal.title}" is at risk — increase daily effort`);
    }

    if (progress >= 80 && progress < 100) {
      insights.push(`🔥 "${goal.title}" is nearing completion — ${progress}%`);
    }

    if (progress >= 100) {
      insights.push(`✅ "${goal.title}" is complete`);
    }

    // Unlinked goal warning
    if (goal.targetType === 'task_count' && goal.linkedTaskIds.length === 0) {
      insights.push(`💡 "${goal.title}" has no linked tasks`);
    }
  });

  return insights.slice(0, 3);
}
