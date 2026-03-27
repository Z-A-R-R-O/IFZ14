import { useMemo } from 'react';
import { useDailyStore } from '../../../stores/dailyStore';
import { useGoalStore } from '../../../stores/goalStore';
import { useTaskStore } from '../../../stores/taskStore';
import { buildReportsModel } from '../../../lib/reports/reportModel';

export function useReportsModel() {
  const entries = useDailyStore(state => state.entries);
  const goals = useGoalStore(state => state.goals);
  const tasks = useTaskStore(state => state.tasks);

  return useMemo(
    () =>
      buildReportsModel({
        entries: Object.values(entries),
        goals,
        tasks,
      }),
    [entries, goals, tasks]
  );
}
