import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../stores/taskStore';
import { useGoalStore } from '../stores/goalStore';
import AnimatedMetric from '../components/AnimatedMetric';
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

const initialTaskWizardData = {
  title: '',
  energyType: 'deep' as TaskEnergyType,
  estimatedTime: 60,
  priority: 'MED' as Task['priority'],
  goalId: undefined as string | undefined,
  preferredTime: 'morning' as 'morning' | 'afternoon' | 'night',
  energyDemand: 'medium' as 'low' | 'medium' | 'high',
  deadline: '' as string,
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

export function CreateTaskWizard({ onClose }: { onClose: (taskId?: string) => void }) {
  const addTask = useTaskStore(s => s.addTask);
  const goals = useGoalStore(s => s.goals);
  const [step, setStep] = useState(0);
  const isCreating = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false);

  const [data, setData] = useState(initialTaskWizardData);

  const hasDraft =
    data.title.trim().length > 0 ||
    data.energyType !== initialTaskWizardData.energyType ||
    data.estimatedTime !== initialTaskWizardData.estimatedTime ||
    data.priority !== initialTaskWizardData.priority ||
    data.goalId !== initialTaskWizardData.goalId ||
    data.preferredTime !== initialTaskWizardData.preferredTime ||
    data.energyDemand !== initialTaskWizardData.energyDemand ||
    data.deadline !== initialTaskWizardData.deadline;

  const queueStep = (nextStep: number, delay = 180) => {
    setCloseArmed(false);
    window.setTimeout(() => setStep(nextStep), delay);
  };

  const handleBack = () => {
    if (step === 0) return;
    setCloseArmed(false);
    setStep(currentStep => Math.max(0, currentStep - 1));
  };

  const handleClose = () => {
    if (!hasDraft || closeArmed) {
      onClose();
      return;
    }

    setCloseArmed(true);
  };

  const steps = [
    {
      title: 'TASK NAME',
      render: () => (
        <div className="task-wizard-input-shell">
          <input
            autoFocus
            className="reflection-input task-wizard-input"
            placeholder="What needs to be done?"
            value={data.title}
            onChange={e => {
              setCloseArmed(false);
              setData({ ...data, title: e.target.value });
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && data.title.trim()) queueStep(1, 120);
            }}
            style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}
          />
          <span className="task-wizard-input-line" />
        </div>
      ),
    },
    {
      title: 'ENERGY TYPE',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['deep', 'light', 'quick'] as const).map(t => (
            <motion.button
              key={t}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.energyType === t ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, energyType: t });
                queueStep(2, 190);
              }}
            >
              <span className="task-wizard-option-kicker">MODE</span>
              {t === 'deep' ? 'DEEP WORK' : t === 'light' ? 'LIGHT WORK' : 'QUICK TASK'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'ESTIMATED TIME',
      render: () => (
        <div className="task-wizard-option-stack">
          {[15, 30, 45, 60, 90, 120].map(m => (
            <motion.button
              key={m}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.estimatedTime === m ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, estimatedTime: m });
                queueStep(3, 180);
              }}
            >
              <span className="task-wizard-option-kicker">WINDOW</span>
              {m < 60 ? `${m}m` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ''}`}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'PRIORITY',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['HIGH', 'MED', 'LOW'] as const).map(p => (
            <motion.button
              key={p}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.priority === p ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, priority: p });
                queueStep(goals.length > 0 ? 4 : 5, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LEVEL</span>
              {p === 'HIGH' ? 'HIGH' : p === 'MED' ? 'MEDIUM' : 'LOW'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'LINKED GOAL (OPTIONAL)',
      render: () => (
        <div className="task-wizard-option-stack">
          {goals.map(g => (
            <motion.button
              key={g.id}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.goalId === g.id ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, goalId: g.id });
                queueStep(5, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LINK</span>
              {g.title}
            </motion.button>
          ))}
          <motion.button
            whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
            whileTap={{ scale: 0.986 }}
            transition={motionTiming.fast}
            className="wizard-option task-wizard-option task-wizard-option-muted"
            onClick={() => queueStep(5, 120)}
            style={{ color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <span className="task-wizard-option-kicker">LINK</span>
            SKIP
          </motion.button>
        </div>
      ),
    },
    {
      title: 'WHEN ARE YOU BEST FOR THIS?',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['morning', 'afternoon', 'night'] as const).map(t => (
            <motion.button
              key={t}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.preferredTime === t ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, preferredTime: t });
                queueStep(6, 180);
              }}
            >
              <span className="task-wizard-option-kicker">SYNC</span>
              {t === 'morning' ? 'MORNING' : t === 'afternoon' ? 'AFTERNOON' : 'NIGHT'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'HOW HEAVY IS IT?',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['low', 'medium', 'high'] as const).map(d => (
            <motion.button
              key={d}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.energyDemand === d ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, energyDemand: d });
                queueStep(7, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LOAD</span>
              {d === 'low' ? 'LOW' : d === 'medium' ? 'MEDIUM' : 'HIGH'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'DEADLINE (OPTIONAL)',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <div className="task-wizard-input-shell" style={{ maxWidth: '320px' }}>
            <input
              type="date"
              className="reflection-input task-wizard-input"
              value={data.deadline}
              onChange={e => {
                setCloseArmed(false);
                setData({ ...data, deadline: e.target.value });
              }}
              style={{
                width: '100%',
                maxWidth: '320px',
                textAlign: 'center',
                colorScheme: 'dark',
              }}
            />
            <span className="task-wizard-input-line" />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className="wizard-option task-wizard-option"
              onClick={() => queueStep(8, 120)}
              style={{ minWidth: '140px' }}
            >
              <span className="task-wizard-option-kicker">EXECUTE</span>
              {data.deadline ? 'CONTINUE' : 'SKIP'}
            </motion.button>
          </div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (step >= steps.length && !isCreating.current) {
      isCreating.current = true;
      setIsConfirming(true);
      const taskId = addTask({
        ...data,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
        splitable: true,
      });
      setTimeout(() => onClose(taskId), 240);
    }
  }, [step, steps.length, addTask, data, onClose]);

  if (step >= steps.length) return null;

  const current = steps[step];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <AnimatePresence>
        {isConfirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.16, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.16), transparent 60%)',
            }}
          />
        )}
      </AnimatePresence>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.04), transparent 70%)',
        }}
      />
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{
          x: [-40, -10, 24, 8, 30, -6, 16, 0][step] ?? 0,
          y: [-12, -4, 8, 0, 10, 4, 12, 0][step] ?? 0,
          scale: [1, 1.02, 1.04, 1.03, 1.05, 1.04, 1.06, 1.03][step] ?? 1,
          opacity: 0.8,
        }}
        transition={motionTiming.medium}
        style={{
          position: 'absolute',
          width: '440px',
          height: '440px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.055), rgba(255,255,255,0.012) 36%, transparent 72%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          transform: 'translateY(-5%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '520px', marginBottom: '56px' }}>
          <div className="task-wizard-topbar">
            <motion.button
              type="button"
              whileHover={{ opacity: 0.9, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={motionTiming.fast}
              className="task-wizard-nav task-wizard-nav-back"
              onClick={handleBack}
              disabled={step === 0}
              aria-label="Go back one step"
            >
              <span className="task-wizard-nav-icon">←</span>
              <span className="task-wizard-nav-text">Back</span>
            </motion.button>
            <div className={typeStyles.identityLabel} style={{ opacity: 0.62 }}>
              CREATE TASK
            </div>
            <motion.button
              type="button"
              whileHover={{ opacity: 0.9, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={motionTiming.fast}
              className="task-wizard-nav task-wizard-nav-close"
              onClick={handleClose}
              aria-label="Close task creation"
            >
              <span className="task-wizard-nav-icon">×</span>
            </motion.button>
          </div>
          <div className="task-wizard-progress" style={{ justifyContent: 'center' }}>
            {steps.map((_, i) => (
              <motion.div
                key={i}
                className={`task-wizard-progress-segment ${i <= step ? 'active' : 'inactive'}`}
                initial={false}
                animate={{
                  opacity: i <= step ? 1 : 0.42,
                  scaleY: i === step ? 1.4 : 1,
                }}
                transition={motionTiming.fast}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            {closeArmed && (
              <motion.div
                key="discard-warning"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={motionTiming.fast}
                className="task-wizard-close-warning"
              >
                Close again to discard this command.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(2px)' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '240px' }}
          >
            <div className="task-wizard-question" style={{ marginBottom: '16px' }}>
              {current.title}
            </div>
            <div className="task-wizard-prompt">
              {closeArmed && 'Pending command will be discarded if you close again.'}
              {!closeArmed && step === 0 && 'System listening for a new command.'}
              {!closeArmed && step === 1 && 'Select the execution mode.'}
              {!closeArmed && step === 2 && 'Lock the time window.'}
              {!closeArmed && step === 3 && 'Set the command priority.'}
              {!closeArmed && step === 4 && 'Link this command if needed.'}
              {!closeArmed && step === 5 && 'Choose the ideal execution window.'}
              {!closeArmed && step === 6 && 'Define the system load.'}
              {!closeArmed && step === 7 && 'Optional final constraint.'}
            </div>
            {current.render()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
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
            onClick={e => {
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
          onClick={e => {
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
  const tasks = useTaskStore(s => s.tasks);
  const toggleTask = useTaskStore(s => s.toggleTask);
  const removeTask = useTaskStore(s => s.removeTask);
  const splitTask = useTaskStore(s => s.splitTask);

  const [showWizard, setShowWizard] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL');

  const insights = useMemo(() => generateTaskInsights(tasks), [tasks]);

  const deepTasks = tasks.filter(t => t.energyType === 'deep' && !t.completed && t.status !== 'skipped');
  const lightTasks = tasks.filter(t => t.energyType !== 'deep' && !t.completed && t.status !== 'skipped');

  const smartQueue = tasks
    .filter(t => !t.completed && t.status !== 'skipped')
    .filter(t => filter === 'ALL' || t.priority === filter)
    .sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (b.scoreImpact?.expected || 0) - (a.scoreImpact?.expected || 0);
    });

  const completedTasks = tasks
    .filter(t => t.completed)
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
              {insights.slice(0, 2).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...motionTiming.fast, delay: dashboardSequence.cards + i * 0.06 }}
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
                    0{i + 1}
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
            {deepTasks.map(task => (
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
            {lightTasks.map(task => (
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
              {(['ALL', 'HIGH', 'MED', 'LOW'] as const).map(f => (
                <motion.button
                  key={f}
                  onClick={() => setFilter(f)}
                  whileHover={{ color: 'rgba(255,255,255,0.88)' }}
                  whileTap={{ scale: 0.985 }}
                  transition={motionTiming.fast}
                  className="font-secondary"
                  style={{
                    padding: '0 0 8px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: filter === f ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                    boxShadow:
                      filter === f
                        ? 'inset 0 -1px 0 rgba(255,255,255,0.5), 0 10px 18px rgba(255,255,255,0.04)'
                        : 'none',
                    color: filter === f ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                  }}
                >
                  {f}
                </motion.button>
              ))}
            </div>
          }
        />

        <AnimatePresence>
          {smartQueue.map(task => (
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
            {completedTasks.slice(0, 10).map(task => (
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
