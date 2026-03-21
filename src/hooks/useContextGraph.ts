import { useMemo } from 'react';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { useDailyStore } from '../stores/dailyStore';
import { computeAllGoals } from '../engines/goalEngine';
import type { Goal, Task, DailyEntry } from '../types';

export interface GraphNode {
  id: string;
  type: 'goal' | 'task' | 'session';
  label: string;
  val: number;
  pressure?: number;
  completed?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
}

export function useContextGraph(contextId: string | null, contextType: 'goal' | 'task' | 'session' | null) {
  const goals = useGoalStore(s => s.goals);
  const tasks = useTaskStore(s => s.tasks);
  const entries = useDailyStore(s => s.entries);
  const allEntries = useMemo(() => Object.values(entries) as DailyEntry[], [entries]);
  
  return useMemo(() => {
    if (!contextId || !contextType) return { nodes: [], links: [], adjacency: new Map<string, string[]>() };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const stats = computeAllGoals(goals, tasks, allEntries);

    let activeGoalId: string | null = null;
    let activeTaskIds: string[] = [];
    let centerNodeId: string = '';

    if (contextType === 'goal') {
      activeGoalId = contextId;
      centerNodeId = `goal-${contextId}`;
    } else if (contextType === 'task') {
      const task = tasks.find(t => t.id === contextId);
      if (task?.goalId) activeGoalId = task.goalId;
      activeTaskIds = [contextId];
      centerNodeId = `task-${contextId}`;
    } else if (contextType === 'session') {
      for (const entry of allEntries) {
        if (!entry.completed) continue;
        const sessions = entry.dynamic_values?.dwSessions || [];
        const sess = sessions.find((s: any) => s.id === contextId);
        if (sess && sess.taskId) {
           activeTaskIds = [sess.taskId];
           const task = tasks.find(t => t.id === sess.taskId);
           if (task?.goalId) activeGoalId = task.goalId;
           centerNodeId = `session-${contextId}`;
           break;
        }
      }
    }

    // Include the goal if identified
    let goal: Goal | undefined;
    if (activeGoalId) {
       goal = goals.find(g => g.id === activeGoalId);
       if (goal) {
          const comp = stats[goal.id];
          const pressure = comp ? Math.min(comp.pressure, 100) : 0;
          nodes.push({
             id: `goal-${goal.id}`,
             type: 'goal',
             label: goal.title,
             val: 10 + (pressure / 10), // Node size: 10 + pressure
             pressure: pressure,
             completed: comp?.progress >= 100
          });
       }
    }

    // Gather tasks
    let relevantTasks: Task[] = [];
    if (goal) {
       relevantTasks = tasks.filter(t => goal!.linkedTaskIds.includes(t.id));
    } else if (activeTaskIds.length > 0) {
       relevantTasks = tasks.filter(t => activeTaskIds.includes(t.id));
    }

    // Sort and limit tasks
    const pOrder: Record<string, number> = { HIGH: 10, MED: 5, LOW: 2 };
    
    // Calculate raw scores
    const scoredTasks = relevantTasks.map(t => ({ 
       ...t, 
       _score: (pOrder[t.priority] || 2) + (t.completed ? -50 : 0) 
    })).sort((a, b) => b._score - a._score);
    
    // Ensure the focused task isn't culled by the slice
    if (contextType === 'task') {
       const idx = scoredTasks.findIndex(t => t.id === contextId);
       if (idx > 4) {
          const pulled = scoredTasks.splice(idx, 1)[0];
          scoredTasks.splice(4, 0, pulled);
       }
    }

    relevantTasks = scoredTasks.slice(0, 5); // Max 5 tasks

    relevantTasks.forEach(task => {
        const impactScore = task.scoreImpact?.expected || 5;
        nodes.push({
           id: `task-${task.id}`,
           type: 'task',
           label: task.title,
           val: 6 + (impactScore / 2),
           completed: task.completed
        });

        if (goal) {
           links.push({ source: `goal-${goal.id}`, target: `task-${task.id}` });
        }
    });

    // Gather sessions for these tasks
    let allRelatedSessions: any[] = [];
    const relevantTaskIds = relevantTasks.map(t => t.id);

    allEntries.filter(e => e.completed).forEach(entry => {
       const sessions = entry.dynamic_values?.dwSessions || [];
       sessions.forEach((sess: any) => {
          if (sess.taskId && relevantTaskIds.includes(sess.taskId)) {
             allRelatedSessions.push({ ...sess, date: entry.date });
          }
       });
    });

    // Sort by recency and limit
    allRelatedSessions = allRelatedSessions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6); // Max 6 sessions

    allRelatedSessions.forEach(sess => {
       nodes.push({
          id: `session-${sess.id}`,
          type: 'session',
          label: sess.taskTitle || 'Session',
          val: 3,
          completed: sess.focus >= 30, // completed if focus is adequate
       });
       links.push({ source: `task-${sess.taskId}`, target: `session-${sess.id}` });
    });

    // Build Adjacency Map for blazing fast hover tracking
    const adjacency = new Map<string, string[]>();
    links.forEach(link => {
       adjacency.set(link.source, [...(adjacency.get(link.source) || []), link.target]);
       adjacency.set(link.target, [...(adjacency.get(link.target) || []), link.source]);
    });

    return { nodes, links, adjacency, centerNodeId };

  }, [contextId, contextType, goals, tasks, allEntries]);
}
