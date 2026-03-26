import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CreateTaskWizard } from '../../../components/CreateTaskWizard';
import type { DailyEntry, DayBlock } from '../../../types';
import { type as typeStyles } from '../../../typography';
import { SectionTitle } from './DailyPrimitives';

export type DeepWorkSession = {
  id: string;
  taskId?: string;
  taskTitle?: string;
  startTime?: string;
  focus?: number;
  quality?: number;
  status?: string;
  duration?: number;
  isCompleted?: boolean;
  isLocked?: boolean;
};

export type DeepTask = {
  id: string;
  title: string;
  goalId?: string;
  priority?: string;
  estimatedTime: number;
  completed?: boolean;
  completedTime?: number;
  energyType?: string;
};

export type DeepWorkSessionRowProps = {
  session: DeepWorkSession;
  idx: number;
  tasks: DeepTask[];
  unassigned: DeepTask[];
  updateSession: (idx: number, updates: Partial<DeepWorkSession>) => void;
  removeSession: (idx: number) => void;
  splitSession: (idx: number) => void;
  canRemove: boolean;
  onStartCreate: () => void;
  isLast?: boolean;
};

type DeepWorkBlockProps = {
  block: DayBlock & { dwCount?: number };
  entry: DailyEntry & {
    dw1FocusQuality?: number;
    dw2FocusQuality?: number;
    dw1PlannedTask?: string;
    dw1ActualTask?: string;
    dw2PrimaryTask?: string;
  };
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
  tasks: DeepTask[];
  lookupTaskTitle: (taskId: string) => string | undefined;
  SessionRow: ComponentType<DeepWorkSessionRowProps>;
};

export function DeepWorkBlock({
  block,
  entry,
  update,
  visual,
  tasks,
  lookupTaskTitle,
  SessionRow,
}: DeepWorkBlockProps) {
  const legacyQualities = [
    (entry.dw1FocusQuality || 0) * 10,
    (entry.dw2FocusQuality || 0) * 10,
  ];

  const sessions: DeepWorkSession[] =
    entry.dynamic_values?.dwSessions ||
    (entry.dynamic_values?.dwQualities || legacyQualities).map(
      (q: number, i: number) => ({
        id: `legacy-${i}`,
        taskTitle: i === 0 ? (entry.dw1PlannedTask || entry.dw1ActualTask || '') : (entry.dw2PrimaryTask || ''),
        focus: q,
        status: q >= 40 ? 'done' : 'pending',
      })
    );

  const minCount = block.dwCount || 2;
  while (sessions.length < minCount) {
    sessions.push({ id: `dw-${Date.now()}-${sessions.length}`, taskTitle: '', focus: 0, status: 'pending', duration: 60, isCompleted: false, isLocked: false });
  }

  const saveSessions = (updated: DeepWorkSession[]) => {
    update({
      dynamic_values: {
        ...entry.dynamic_values,
        dwSessions: updated,
      },
    });
  };

  const updateSession = (idx: number, updates: Partial<DeepWorkSession>) => {
    const updated = [...sessions];
    updated[idx] = { ...updated[idx], ...updates };
    saveSessions(updated);
  };

  const addSession = () => saveSessions([...sessions, { id: `dw-${Date.now()}`, taskTitle: '', focus: 0, status: 'pending', duration: 60, isCompleted: false, isLocked: false }]);

  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return;
    saveSessions(sessions.filter((_, i) => i !== idx));
  };

  const splitSession = (idx: number) => {
    const session = sessions[idx];
    if (session.isCompleted) return;

    const currentDuration = session.duration || 60;
    const half = Math.floor(currentDuration / 2);

    const updatedCurrent = { ...session, duration: half };
    const clonedBlank: DeepWorkSession = {
      id: `dw-${Date.now()}`,
      taskId: session.taskId,
      taskTitle: session.taskTitle,
      focus: 0,
      status: 'pending',
      duration: currentDuration - half,
      isCompleted: false,
      isLocked: false,
    };

    const newSessions = [...sessions];
    newSessions[idx] = updatedCurrent;
    newSessions.splice(idx + 1, 0, clonedBlank);
    saveSessions(newSessions);
  };

  const unassigned = useMemo(() => {
    return tasks.filter((task) => !task.completed && task.energyType === 'deep' && !sessions.some((session) => session.taskId === task.id));
  }, [tasks, sessions]);

  const [creatingForIdx, setCreatingForIdx] = useState<number | null>(null);

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="EXECUTION TIMELINE" i={2} />
      <div className="daily-timeline-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.map((session, idx) => (
          <SessionRow
            key={session.id}
            session={session}
            idx={idx}
            tasks={tasks}
            unassigned={unassigned}
            updateSession={updateSession}
            removeSession={removeSession}
            splitSession={splitSession}
            canRemove={sessions.length > 1}
            onStartCreate={() => setCreatingForIdx(idx)}
            isLast={idx === sessions.length - 1}
          />
        ))}
        <button className="add-session-btn daily-add-session-node" onClick={addSession}>+ ADD SESSION</button>

        {unassigned.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
            <div className={typeStyles.label} style={{ color: '#fff', opacity: 0.8, marginBottom: '12px', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>UNSCHEDULED TASKS</div>
            {unassigned.map((task) => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#bfbfbf', marginBottom: '6px' }}>
                <span>- {task.title} ({task.priority})</span>
                <button
                  onClick={() => {
                    const emptyIdx = sessions.findIndex((session) => !session.taskId && !session.taskTitle);
                    if (emptyIdx >= 0) updateSession(emptyIdx, { taskId: task.id, taskTitle: task.title, isLocked: false });
                    else {
                      const nextSessions = [...sessions, { id: `dw-${Date.now()}`, taskId: task.id, taskTitle: task.title, focus: 0, status: 'pending', duration: 60, isLocked: false }];
                      saveSessions(nextSessions);
                    }
                  }}
                  className="daily-add-to-session-btn"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#5A5A5A', fontSize: '9px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ADD TO SESSION
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {creatingForIdx !== null && (
          <CreateTaskWizard
            onClose={(taskId) => {
              if (taskId) {
                const title = lookupTaskTitle(taskId);
                updateSession(creatingForIdx, { taskId, taskTitle: title, isLocked: false });
              }
              setCreatingForIdx(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
