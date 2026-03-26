import { useState, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../stores/taskStore';
import AnimatedMetric from '../components/AnimatedMetric';
import { CreateTaskWizard } from '../components/CreateTaskWizard';
import { generateTaskInsights } from '../engines/taskEngine';
import { dashboardSequence, motionTiming } from '../motion';
import { type as typeStyles } from '../typography';
import type { Task, TaskEnergyType } from '../types';

const priorityOrder: Record<string, number> = { HIGH: 0, MED: 1, LOW: 2 };

const energySectionLabel: Record<TaskEnergyType, string> = {
  deep: 'DEEP EXECUTION',
  light: 'LIGHT TASKS',
  quick: 'QUICK TASKS',
};

function formatTaskDuration(minutes: number) {
  return `${minutes}M`;
}

function priorityAccent(priority: Task['priority']) {
  if (priority === 'HIGH') return 'rgba(150, 214, 168, 0.88)';
  if (priority === 'MED') return 'rgba(255,255,255,0.62)';
  return 'rgba(255,255,255,0.42)';
}

function sectionTone(label: string) {
  if (label.includes('DEEP')) return 'rgba(140, 181, 232, 0.78)';
  if (label.includes('LIGHT')) return 'rgba(255,255,255,0.62)';
  if (label.includes('SMART')) return 'rgba(255,255,255,0.78)';
  return 'rgba(255,255,255,0.34)';
}

function SectionHeader({
  label,
  controls,
}: {
  label: string;
  controls?: ReactNode;
}) {
  const tone = sectionTone(label);

  return (
    <div style={{ marginBottom: '18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '16px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span
          className={typeStyles.label}
          style={{
            color: tone,
            opacity: 0.82,
          }}
        >
          {label}
        </span>
        {controls}
      </div>
      <div
        style={{
          height: '1px',
          background: `linear-gradient(90deg, ${tone}, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0))`,
        }}
      />
    </div>
  );
}

function HudMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px auto',
        alignItems: 'baseline',
        gap: '14px',
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: '10px',
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.42)',
        }}
      >
        {label}
      </span>
      <span className="metric-number-xs" style={{ color: 'rgba(255,255,255,0.88)' }}>
        <AnimatedMetric value={value} />
      </span>
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onRemove,
  onSplit,
}: {
  task: Task;
  onToggle: () => void;
  onRemove: () => void;
  onSplit: () => void;
}) {
  const canSplit = task.estimatedTime > 90 && !task.subtaskIds?.length && !task.completed;
  const laneLabel = task.completed ? 'PROCESSED' : energySectionLabel[task.energyType];
  const rowOpacity = task.completed ? 0.5 : 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: rowOpacity, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: motionTiming.fast }}
      whileHover={
        task.completed
          ? undefined
          : {
              y: -2,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(255,255,255,0.038)',
            }
      }
      transition={motionTiming.fast}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px minmax(0, 1fr) auto auto',
        alignItems: 'center',
        gap: '16px',
        minHeight: '72px',
        padding: '14px 16px',
        marginBottom: '10px',
        borderRadius: '16px',
        border: `1px solid ${task.completed ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`,
        background: task.completed ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.02)',
        boxShadow: task.completed ? 'none' : '0 10px 24px rgba(0,0,0,0.14)',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <motion.div
        initial={false}
        animate={{
          borderColor: task.completed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.16)',
          backgroundColor: task.completed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)',
        }}
        transition={motionTiming.fast}
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AnimatePresence initial={false}>
          {task.completed && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={motionTiming.fast}
              className="font-mono"
              style={{ fontSize: '10px', color: 'rgba(255,255,255,0.72)' }}
            >
              01
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <span
            className="font-primary"
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: task.completed ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.96)',
              lineHeight: 1.2,
            }}
          >
            {task.title}
          </span>
          <motion.span
            initial={false}
            animate={{ scaleX: task.completed ? 1 : 0, opacity: task.completed ? 0.9 : 0 }}
            transition={motionTiming.fast}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '9px',
              height: '1px',
              background: 'rgba(255,255,255,0.4)',
              transformOrigin: 'left center',
            }}
          />
          <span
            className="font-secondary"
            style={{
              fontSize: '11px',
              letterSpacing: '0.12em',
              color: task.completed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.38)',
            }}
          >
            {laneLabel}
          </span>
        </div>
      </div>

      <div
        className="font-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '14px',
          flexWrap: 'wrap',
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: task.completed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)',
        }}
      >
        <span>{formatTaskDuration(task.estimatedTime)}</span>
        <span style={{ color: priorityAccent(task.priority) }}>{task.priority}</span>
        {task.scoreImpact && (
          <span style={{ color: task.completed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.78)' }}>
            +{task.scoreImpact.expected}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {canSplit && (
          <motion.button
            whileHover={{ borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.72)' }}
            whileTap={{ scale: 0.985 }}
            transition={motionTiming.fast}
            onClick={(e) => {
              e.stopPropagation();
              onSplit();
            }}
            className="font-primary"
            style={{
              minWidth: '58px',
              padding: '6px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.42)',
              cursor: 'pointer',
              fontSize: '10px',
              letterSpacing: '0.12em',
            }}
          >
            SPLIT
          </motion.button>
        )}

        <motion.button
          whileHover={{ color: 'rgba(255,255,255,0.78)' }}
          whileTap={{ scale: 0.96 }}
          transition={motionTiming.fast}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="font-secondary"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
            color: 'rgba(255,255,255,0.26)',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
          }}
          aria-label={`Remove ${task.title}`}
        >
          x
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function Tasks() {
  const tasks = useTaskStore((s) => s.tasks);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const splitTask = useTaskStore((s) => s.splitTask);

  const [showWizard, setShowWizard] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL');

  const insights = useMemo(() => generateTaskInsights(tasks), [tasks]);

  const deepTasks = tasks.filter((task) => task.energyType === 'deep' && !task.completed && task.status !== 'skipped');
  const lightTasks = tasks.filter((task) => task.energyType !== 'deep' && !task.completed && task.status !== 'skipped');

  const smartQueue = tasks
    .filter((task) => !task.completed && task.status !== 'skipped')
    .filter((task) => filter === 'ALL' || task.priority === filter)
    .sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (b.scoreImpact?.expected || 0) - (a.scoreImpact?.expected || 0);
    });

  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt));

  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={motionTiming.slow}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '28px',
          flexWrap: 'wrap',
          marginBottom: '46px',
        }}
      >
        <div style={{ flex: '1 1 420px', minWidth: '280px' }}>
          <motion.p
            className={typeStyles.identityLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionTiming.fast, delay: dashboardSequence.heading }}
            style={{ marginBottom: '14px' }}
          >
            SYSTEM ONLINE
          </motion.p>
          <motion.h1
            className={typeStyles.hero}
            initial={{ opacity: 0, y: 14, letterSpacing: '0.14em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.09em' }}
            transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.08 }}
            style={{ marginBottom: '8px' }}
          >
            WORK MODE
          </motion.h1>
          <motion.p
            className="body"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.14 }}
            style={{
              maxWidth: '420px',
              marginBottom: insights.length > 0 ? '16px' : '24px',
              color: 'rgba(255,255,255,0.66)',
            }}
          >
            Tasks queued. Execution ready.
          </motion.p>

          {insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTiming.medium, delay: dashboardSequence.cards }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}
            >
              {insights.slice(0, 2).map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...motionTiming.fast, delay: dashboardSequence.cards + index * 0.06 }}
                  className="font-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: 'fit-content',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span className="font-mono" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    0{index + 1}
                  </span>
                  {msg}
                </motion.div>
              ))}
            </motion.div>
          )}

          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{
              y: -1,
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.03)',
              boxShadow: '0 0 20px rgba(255,255,255,0.06)',
            }}
            whileTap={{ scale: 0.985 }}
            transition={{ ...motionTiming.fast, delay: dashboardSequence.cards }}
            onClick={() => setShowWizard(true)}
            className={typeStyles.button}
            style={{
              padding: '12px 22px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.015)',
              color: 'rgba(255,255,255,0.92)',
              cursor: 'pointer',
              letterSpacing: '0.18em',
            }}
          >
            + CREATE TASK
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...motionTiming.medium, delay: dashboardSequence.hud }}
          style={{
            minWidth: '168px',
            padding: '16px 18px',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            boxShadow: '0 18px 36px rgba(0,0,0,0.12)',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.38)',
              marginBottom: '14px',
            }}
          >
            EXECUTION HUD
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <HudMetric label="RATE" value={completionRate} />
            <HudMetric label="DEEP" value={deepTasks.length} />
            <HudMetric label="LIGHT" value={lightTasks.length} />
          </div>
        </motion.div>
      </div>

      {deepTasks.length > 0 && (
        <div style={{ marginBottom: '38px' }}>
          <SectionHeader label="DEEP EXECUTION" />
          <AnimatePresence>
            {deepTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onSplit={() => splitTask(task.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {lightTasks.length > 0 && (
        <div style={{ marginBottom: '38px' }}>
          <SectionHeader label="LIGHT / QUICK TASKS" />
          <AnimatePresence>
            {lightTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onSplit={() => splitTask(task.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div style={{ marginBottom: '38px' }}>
        <SectionHeader
          label="SMART QUEUE"
          controls={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['ALL', 'HIGH', 'MED', 'LOW'] as const).map((currentFilter) => (
                <motion.button
                  key={currentFilter}
                  onClick={() => setFilter(currentFilter)}
                  whileHover={{ color: 'rgba(255,255,255,0.88)' }}
                  whileTap={{ scale: 0.985 }}
                  transition={motionTiming.fast}
                  className="font-secondary"
                  style={{
                    padding: '0 0 8px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: filter === currentFilter ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                    boxShadow:
                      filter === currentFilter
                        ? 'inset 0 -1px 0 rgba(255,255,255,0.5), 0 10px 18px rgba(255,255,255,0.04)'
                        : 'none',
                    color: filter === currentFilter ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                  }}
                >
                  {currentFilter}
                </motion.button>
              ))}
            </div>
          }
        />

        <AnimatePresence>
          {smartQueue.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onRemove={() => removeTask(task.id)}
              onSplit={() => splitTask(task.id)}
            />
          ))}
        </AnimatePresence>

        {smartQueue.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.015)',
              textAlign: 'center',
            }}
          >
            <div className="body" style={{ color: 'rgba(255,255,255,0.46)' }}>
              Queue clear.
            </div>
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div>
          <SectionHeader label={`COMPLETED ${completedTasks.length}`} />
          <AnimatePresence>
            {completedTasks.slice(0, 10).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onSplit={() => splitTask(task.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {tasks.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: '48px' }}>
          <div className="body" style={{ color: 'rgba(255,255,255,0.52)' }}>
            No tasks queued. Create one to begin.
          </div>
        </div>
      )}

      <AnimatePresence>{showWizard && <CreateTaskWizard onClose={() => setShowWizard(false)} />}</AnimatePresence>
    </motion.div>
  );
}
