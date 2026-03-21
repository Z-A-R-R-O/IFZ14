import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AnimatedMetric from '../components/AnimatedMetric';
import { computeAllGoals, generateGoalInsights } from '../engines/goalEngine';
import { type as typeStyles } from '../typography';
import type { DailyEntry, GoalTargetType, GoalWithComputed, Task } from '../types';
import { useDailyStore } from '../stores/dailyStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import SystemSurface from '../ui/components/SystemSurface';
import { fadeInUp, surfaceInteraction, uiMotion } from '../ui/motion/presets';

const goalWizardInitialData = {
  title: '',
  targetType: 'task_count' as GoalTargetType,
  targetValue: 10,
  trackDeepWork: false,
  deadline: '',
  linkedTaskIds: [] as string[],
};

const goalTypeOptions = [
  {
    type: 'task_count' as const,
    label: 'NUMERIC TARGET',
    kicker: 'COUNT',
    description: 'Complete a fixed number of linked tasks.',
    defaultValue: 10,
    trackDeepWork: false,
  },
  {
    type: 'time' as const,
    label: 'HABIT CADENCE',
    kicker: 'TIME',
    description: 'Accumulate focused work toward the target.',
    defaultValue: 1500,
    trackDeepWork: true,
  },
  {
    type: 'milestone' as const,
    label: 'OUTPUT LOCK',
    kicker: 'STATE',
    description: 'Drive one decisive completion state.',
    defaultValue: 100,
    trackDeepWork: false,
  },
] as const;

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysLeft(deadline?: string) {
  if (!deadline) return null;
  const due = parseLocalDate(deadline).setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDeadline(deadline?: string) {
  if (!deadline) return 'OPEN WINDOW';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parseLocalDate(deadline));
}

function formatUnits(targetType: GoalTargetType, value: number) {
  if (targetType === 'time') {
    const hours = value / 60;
    return Number.isInteger(hours) ? `${hours}H` : `${hours.toFixed(1)}H`;
  }
  if (targetType === 'milestone') return value >= 100 ? 'LOCKED' : `${value}%`;
  return `${value}`;
}

function formatProgressDetail(goal: GoalWithComputed) {
  if (goal.targetType === 'milestone') {
    return goal.progress >= 100 ? 'DECISIVE OUTPUT COMPLETE' : 'AWAITING FINAL OUTPUT';
  }

  return `${formatUnits(goal.targetType, goal.currentValue)} / ${formatUnits(goal.targetType, goal.targetValue)}`;
}

function targetTypeLabel(targetType: GoalTargetType) {
  if (targetType === 'task_count') return 'NUMERIC TARGET';
  if (targetType === 'time') return 'HABIT CADENCE';
  return 'OUTPUT LOCK';
}

function riskTone(risk: GoalWithComputed['riskLevel']) {
  if (risk === 'high') {
    return {
      accent: 'rgba(255, 132, 132, 0.94)',
      border: 'rgba(255, 132, 132, 0.2)',
      bg: 'rgba(255, 132, 132, 0.05)',
      label: 'CRITICAL',
    };
  }

  if (risk === 'medium') {
    return {
      accent: 'rgba(255, 205, 132, 0.9)',
      border: 'rgba(255, 205, 132, 0.16)',
      bg: 'rgba(255, 205, 132, 0.04)',
      label: 'DRIFT',
    };
  }

  return {
    accent: 'rgba(168, 219, 188, 0.9)',
    border: 'rgba(168, 219, 188, 0.16)',
    bg: 'rgba(168, 219, 188, 0.04)',
    label: 'ALIGNED',
  };
}

function deriveAlignment(goals: GoalWithComputed[]) {
  if (goals.length === 0) {
    return {
      label: 'DRIFT',
      detail: 'No active targets locked.',
      accent: 'rgba(255,255,255,0.68)',
    };
  }

  if (goals.some(goal => goal.riskLevel === 'high')) {
    return {
      label: 'CRITICAL',
      detail: 'At least one target is off required pace.',
      accent: 'rgba(255, 132, 132, 0.94)',
    };
  }

  if (goals.some(goal => goal.riskLevel === 'medium')) {
    return {
      label: 'DRIFT',
      detail: 'Execution needs tighter target alignment.',
      accent: 'rgba(255, 205, 132, 0.92)',
    };
  }

  return {
    label: 'ALIGNED',
    detail: 'Execution is holding target direction.',
    accent: 'rgba(168, 219, 188, 0.94)',
  };
}

function paceLabel(goal: GoalWithComputed) {
  if (goal.requiredPace === null) return 'NO PACE LOCK';
  if (goal.requiredPace <= 0) return 'PACE SATISFIED';
  return `${formatUnits(goal.targetType, goal.requiredPace)} / DAY`;
}

function buildGoalIntelligence(goals: GoalWithComputed[], tasks: Task[], engineInsights: string[]) {
  const lines: string[] = [];
  const activeGoals = goals.filter(goal => goal.progress < 100);
  const primaryGoal = activeGoals[0] ?? goals[0];

  if (primaryGoal) {
    const remaining = Math.max(primaryGoal.targetValue - primaryGoal.currentValue, 0);
    if (primaryGoal.requiredPace && primaryGoal.requiredPace > 0) {
      lines.push(
        `${primaryGoal.title} requires ${formatUnits(primaryGoal.targetType, primaryGoal.requiredPace)} per day to hold the deadline.`
      );
    } else if (primaryGoal.progress < 100) {
      lines.push(`${primaryGoal.title} is progressing cleanly and does not need a tighter pace lock yet.`);
    }

    if (remaining > 0 && primaryGoal.deadline) {
      const dueIn = daysLeft(primaryGoal.deadline);
      if (dueIn !== null) {
        lines.push(`${remaining} units remain on ${primaryGoal.title} with ${Math.max(dueIn, 0)} days left in the window.`);
      }
    }

    const linkedTasks = tasks.filter(task => primaryGoal.linkedTaskIds.includes(task.id));
    if (linkedTasks.length > 0) {
      const completedLinked = linkedTasks.filter(task => task.completed).length;
      lines.push(`${completedLinked}/${linkedTasks.length} linked tasks have already moved ${primaryGoal.title} forward.`);
    } else {
      lines.push(`${primaryGoal.title} has no linked tasks yet. Link execution nodes so the system can drive progress.`);
    }

    if (primaryGoal.contributionScore > 0) {
      lines.push(`Linked execution has created +${primaryGoal.contributionScore} impact toward ${primaryGoal.title}.`);
    }
  }

  for (const insight of engineInsights) {
    const cleaned = insight.replace(/^["\s]+|["\s]+$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    if (cleaned) lines.push(cleaned);
  }

  return Array.from(new Set(lines)).slice(0, 4);
}

type GoalWizardProps = {
  onClose: (goalId?: string) => void;
};

function CreateGoalWizard({ onClose }: GoalWizardProps) {
  const createGoal = useGoalStore(state => state.createGoal);
  const tasks = useTaskStore(state => state.tasks);
  const goals = useGoalStore(state => state.goals);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(goalWizardInitialData);
  const [closeArmed, setCloseArmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const isCreating = useRef(false);

  const availableTasks = useMemo(() => {
    const linkedIds = new Set(goals.flatMap(goal => goal.linkedTaskIds));
    return tasks.filter(task => !task.completed && !linkedIds.has(task.id));
  }, [goals, tasks]);

  const hasDraft =
    data.title.trim().length > 0 ||
    data.targetType !== goalWizardInitialData.targetType ||
    data.targetValue !== goalWizardInitialData.targetValue ||
    data.deadline !== goalWizardInitialData.deadline ||
    data.trackDeepWork !== goalWizardInitialData.trackDeepWork ||
    data.linkedTaskIds.length > 0;

  const queueStep = (nextStep: number, delay = 180) => {
    setCloseArmed(false);
    window.setTimeout(() => setStep(nextStep), delay);
  };

  const handleBack = () => {
    if (step === 0) return;
    setCloseArmed(false);
    setStep(current => Math.max(0, current - 1));
  };

  const handleClose = () => {
    if (!hasDraft || closeArmed) {
      onClose();
      return;
    }
    setCloseArmed(true);
  };

  const targetValuePresets = data.targetType === 'time'
    ? [
        { label: '10 HOURS', value: 600, detail: 'Foundational cadence' },
        { label: '25 HOURS', value: 1500, detail: 'Strong weekly execution' },
        { label: '50 HOURS', value: 3000, detail: 'Deep commitment window' },
        { label: '100 HOURS', value: 6000, detail: 'Long-cycle system build' },
      ]
    : data.targetType === 'milestone'
      ? [{ label: 'SINGLE OUTPUT LOCK', value: 100, detail: 'One decisive completion state' }]
      : [
          { label: '5 TASKS', value: 5, detail: 'Compact objective' },
          { label: '10 TASKS', value: 10, detail: 'Default system batch' },
          { label: '25 TASKS', value: 25, detail: 'Sustained execution target' },
          { label: '50 TASKS', value: 50, detail: 'Large operational cycle' },
        ];

  const steps = [
    {
      title: 'GOAL NAME',
      prompt: 'Define the target clearly. The system will organize execution around it.',
      render: () => (
        <div className="task-wizard-input-shell">
          <input
            autoFocus
            className="reflection-input task-wizard-input"
            placeholder="What target are you locking?"
            value={data.title}
            onChange={event => {
              setCloseArmed(false);
              setData({ ...data, title: event.target.value });
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && data.title.trim()) queueStep(1, 120);
            }}
            style={{ width: '100%', maxWidth: '460px', textAlign: 'center' }}
          />
          <span className="task-wizard-input-line" />
        </div>
      ),
    },
    {
      title: 'TARGET TYPE',
      prompt: 'Choose the target logic the system should optimize around.',
      render: () => (
        <div className="task-wizard-option-stack">
          {goalTypeOptions.map(option => (
            <motion.button
              key={option.type}
              type="button"
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={uiMotion.fast}
              className={`wizard-option task-wizard-option ${data.targetType === option.type ? 'selected' : ''}`}
              onClick={() => {
                setData({
                  ...data,
                  targetType: option.type,
                  targetValue: option.defaultValue,
                  trackDeepWork: option.trackDeepWork,
                });
                queueStep(2, 180);
              }}
            >
              <span className="task-wizard-option-kicker">{option.kicker}</span>
              {option.label}
              <span className="task-wizard-option-kicker" style={{ letterSpacing: '0.08em', color: 'rgba(255,255,255,0.42)' }}>
                {option.description}
              </span>
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: data.targetType === 'time' ? 'TARGET VALUE' : data.targetType === 'milestone' ? 'OUTPUT STATE' : 'TARGET COUNT',
      prompt: 'Set the scale of the target. Keep it calm, measurable, and real.',
      render: () => (
        <div className="task-wizard-option-stack">
          {targetValuePresets.map(option => (
            <motion.button
              key={option.label}
              type="button"
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={uiMotion.fast}
              className={`wizard-option task-wizard-option ${data.targetValue === option.value ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, targetValue: option.value });
                queueStep(3, 180);
              }}
            >
              <span className="task-wizard-option-kicker">VALUE</span>
              {option.label}
              <span className="task-wizard-option-kicker" style={{ letterSpacing: '0.08em', color: 'rgba(255,255,255,0.42)' }}>
                {option.detail}
              </span>
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'DEADLINE',
      prompt: 'Lock a time boundary if the target needs urgency. Otherwise leave the window open.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
          <div className="task-wizard-input-shell" style={{ maxWidth: '340px' }}>
            <input
              type="date"
              className="reflection-input task-wizard-input"
              value={data.deadline}
              onChange={event => {
                setCloseArmed(false);
                setData({ ...data, deadline: event.target.value });
              }}
              style={{ width: '100%', textAlign: 'center', colorScheme: 'dark' }}
            />
            <span className="task-wizard-input-line" />
          </div>
          <motion.button
            type="button"
            whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
            whileTap={{ scale: 0.986 }}
            transition={uiMotion.fast}
            className="wizard-option task-wizard-option"
            onClick={() => queueStep(4, 120)}
            style={{ minWidth: '180px' }}
          >
            <span className="task-wizard-option-kicker">WINDOW</span>
            {data.deadline ? 'LOCK DEADLINE' : 'SKIP WINDOW'}
          </motion.button>
        </div>
      ),
    },
    {
      title: 'LINK TASKS',
      prompt: 'Attach execution nodes now so the goal structure can drive the work queue.',
      render: () => (
        <div className="task-wizard-option-stack" style={{ maxHeight: '48vh', overflowY: 'auto', paddingRight: '4px' }}>
          {availableTasks.length > 0 ? (
            <>
              {availableTasks.slice(0, 8).map(task => {
                const selected = data.linkedTaskIds.includes(task.id);
                return (
                  <motion.button
                    key={task.id}
                    type="button"
                    whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
                    whileTap={{ scale: 0.986 }}
                    transition={uiMotion.fast}
                    className={`wizard-option task-wizard-option ${selected ? 'selected' : ''}`}
                    onClick={() => {
                      setCloseArmed(false);
                      setData({
                        ...data,
                        linkedTaskIds: selected
                          ? data.linkedTaskIds.filter(id => id !== task.id)
                          : [...data.linkedTaskIds, task.id],
                      });
                    }}
                  >
                    <span className="task-wizard-option-kicker">{task.priority}</span>
                    {task.title}
                    <span className="task-wizard-option-kicker" style={{ letterSpacing: '0.08em', color: 'rgba(255,255,255,0.42)' }}>
                      {task.energyType.toUpperCase()} | {task.estimatedTime}M
                    </span>
                  </motion.button>
                );
              })}
              <motion.button
                type="button"
                whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
                whileTap={{ scale: 0.986 }}
                transition={uiMotion.fast}
                className="wizard-option task-wizard-option"
                onClick={() => queueStep(5, 120)}
                style={{ minWidth: '180px' }}
              >
                <span className="task-wizard-option-kicker">EXECUTE</span>
                {data.linkedTaskIds.length > 0 ? `LOCK ${data.linkedTaskIds.length} TASKS` : 'CONTINUE WITHOUT TASKS'}
              </motion.button>
            </>
          ) : (
            <>
              <div className="task-wizard-prompt" style={{ marginBottom: 0 }}>
                No unlinked tasks are available. You can attach execution nodes later from the work queue.
              </div>
              <motion.button
                type="button"
                whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
                whileTap={{ scale: 0.986 }}
                transition={uiMotion.fast}
                className="wizard-option task-wizard-option"
                onClick={() => queueStep(5, 120)}
                style={{ minWidth: '180px' }}
              >
                <span className="task-wizard-option-kicker">EXECUTE</span>
                FINALIZE TARGET
              </motion.button>
            </>
          )}
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (step < steps.length || isCreating.current) return;

    isCreating.current = true;
    setIsConfirming(true);
    createGoal({
      title: data.title,
      targetType: data.targetType,
      targetValue: data.targetValue,
      trackDeepWork: data.trackDeepWork,
      deadline: data.deadline || undefined,
      linkedTaskIds: data.linkedTaskIds,
    });

    const createdGoals = useGoalStore.getState().goals;
    const newGoal = createdGoals[createdGoals.length - 1];
    if (newGoal) {
      data.linkedTaskIds.forEach(taskId => {
        useTaskStore.getState().updateTask(taskId, { goalId: newGoal.id });
      });
    }

    window.setTimeout(() => onClose(newGoal?.id), 240);
  }, [createGoal, data, onClose, step, steps.length]);

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
        {isConfirming ? (
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
        ) : null}
      </AnimatePresence>
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{
          x: [-18, 12, 24, -8, 18][step] ?? 0,
          y: [-10, -4, 10, 2, 12][step] ?? 0,
          scale: [1, 1.03, 1.05, 1.02, 1.06][step] ?? 1,
          opacity: 0.78,
        }}
        transition={uiMotion.smooth}
        style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05), rgba(255,255,255,0.012) 38%, transparent 72%)',
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
          alignItems: 'center',
          transform: 'translateY(-4%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '540px', marginBottom: '54px' }}>
          <div className="task-wizard-topbar">
            <motion.button
              type="button"
              whileHover={{ opacity: 0.9, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={uiMotion.fast}
              className="task-wizard-nav task-wizard-nav-back"
              onClick={handleBack}
              disabled={step === 0}
              aria-label="Go back one step"
            >
              <span className="task-wizard-nav-icon">&larr;</span>
              <span className="task-wizard-nav-text">Back</span>
            </motion.button>
            <div className={typeStyles.identityLabel} style={{ opacity: 0.62 }}>
              DEFINE TARGET
            </div>
            <motion.button
              type="button"
              whileHover={{ opacity: 0.9, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={uiMotion.fast}
              className="task-wizard-nav task-wizard-nav-close"
              onClick={handleClose}
              aria-label="Close goal creation"
            >
              <span className="task-wizard-nav-icon">&times;</span>
            </motion.button>
          </div>

          <div className="task-wizard-progress">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`task-wizard-progress-segment ${index <= step ? 'active' : 'inactive'}`}
              />
            ))}
          </div>
          {closeArmed ? (
            <div className="task-wizard-close-warning">
              Draft target detected. Press close again to abort the sequence.
            </div>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.34, ease: [0.2, 0.95, 0.2, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div className="task-wizard-question">{current.title}</div>
            <div className="task-wizard-prompt">{current.prompt}</div>
            {current.render()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

type GoalMissionRowProps = {
  goal: GoalWithComputed;
  delay: number;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

function GoalMissionRow({ goal, delay, selected, onHover, onSelect, onDelete }: GoalMissionRowProps) {
  const tone = riskTone(goal.riskLevel);
  const remainingDays = daysLeft(goal.deadline);

  return (
    <motion.div
      {...fadeInUp(delay, 10)}
      whileHover={surfaceInteraction.hover}
      whileTap={surfaceInteraction.tap}
      className="ifz14-card surface-base parallax-layer-2 goal-mission-row"
      onMouseEnter={() => onHover(goal.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(goal.id)}
      style={{
        cursor: 'pointer',
        borderColor: selected ? tone.border : undefined,
        background: selected ? tone.bg : undefined,
        boxShadow: selected ? `0 18px 32px rgba(0,0,0,0.24), inset 0 0 0 1px ${tone.border}` : undefined,
      }}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onDelete(goal.id);
        }}
        style={{
          position: 'absolute',
          top: '18px',
          right: '18px',
          border: 'none',
          background: 'transparent',
          color: 'rgba(255,255,255,0.24)',
          fontSize: '16px',
          cursor: 'pointer',
        }}
        aria-label={`Delete ${goal.title}`}
      >
        &times;
      </button>
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', paddingRight: '24px', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '0.02em',
                color: 'rgba(255,255,255,0.96)',
                marginBottom: '8px',
                wordBreak: 'break-word',
              }}
            >
              {goal.title}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'center' }}>
              <span className={typeStyles.label} style={{ opacity: 0.68 }}>
                {targetTypeLabel(goal.targetType)}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  color: tone.accent,
                }}
              >
                {tone.label}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '104px' }}>
            <div className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)' }}>
              <AnimatedMetric value={goal.progress} />
              <span style={{ fontSize: '0.56em', marginLeft: '2px', color: 'rgba(255,255,255,0.42)' }}>%</span>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.16em',
                color: remainingDays !== null && remainingDays <= 3 ? tone.accent : 'rgba(255,255,255,0.42)',
              }}
            >
              {remainingDays === null ? 'OPEN WINDOW' : remainingDays <= 0 ? 'OVERDUE' : `${remainingDays} DAYS LEFT`}
            </div>
          </div>
        </div>

        <div>
          <div
            style={{
              height: '3px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '100%',
                borderRadius: '999px',
                background: tone.accent,
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '14px 18px',
          }}
        >
          <div>
            <div className={typeStyles.label} style={{ opacity: 0.5, marginBottom: '6px' }}>
              TARGET
            </div>
            <div className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', letterSpacing: '0.08em' }}>
              {formatProgressDetail(goal)}
            </div>
          </div>
          <div>
            <div className={typeStyles.label} style={{ opacity: 0.5, marginBottom: '6px' }}>
              DEADLINE
            </div>
            <div className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', letterSpacing: '0.08em' }}>
              {formatDeadline(goal.deadline)}
            </div>
          </div>
          <div>
            <div className={typeStyles.label} style={{ opacity: 0.5, marginBottom: '6px' }}>
              PACE
            </div>
            <div className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', letterSpacing: '0.08em' }}>
              {paceLabel(goal)}
            </div>
          </div>
          <div>
            <div className={typeStyles.label} style={{ opacity: 0.5, marginBottom: '6px' }}>
              IMPACT
            </div>
            <div className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', letterSpacing: '0.08em' }}>
              +{goal.contributionScore}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type GoalStructurePanelProps = {
  goal: GoalWithComputed | null;
  tasks: Task[];
};

function GoalStructurePanel({ goal, tasks }: GoalStructurePanelProps) {
  if (!goal) {
    return (
      <SystemSurface as="section" interactive={false} delay={0.18} style={{ padding: '28px', minHeight: '100%' }}>
        <div className={typeStyles.label} style={{ marginBottom: '14px', opacity: 0.74 }}>
          GOAL STRUCTURE
        </div>
        <div className="goal-structure-empty">
          Hover or select a goal to view structure.
        </div>
      </SystemSurface>
    );
  }

  const linkedTasks = tasks.filter(task => goal.linkedTaskIds.includes(task.id));
  const actionLines = goal.progress >= 100
    ? ['Target complete. Maintain system consistency and open the next target lock.']
    : [
        goal.requiredPace && goal.requiredPace > 0
          ? `Hold ${formatUnits(goal.targetType, goal.requiredPace)} per day to stay aligned.`
          : 'Current pace is sufficient. Protect consistency.',
        linkedTasks.length > 0
          ? `${linkedTasks.filter(task => task.completed).length}/${linkedTasks.length} linked tasks already executed.`
          : 'Link tasks from Work mode to give this goal an execution path.',
      ];

  return (
    <SystemSurface
      as="section"
      interactive={false}
      delay={0.18}
      variant={goal.riskLevel === 'high' ? 'critical' : 'base'}
      style={{ padding: '28px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <div className={typeStyles.label} style={{ marginBottom: '10px', opacity: 0.74 }}>
            GOAL STRUCTURE
          </div>
          <div style={{ fontFamily: 'var(--font-primary)', fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.96)' }}>
            {goal.title}
          </div>
        </div>
        <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: riskTone(goal.riskLevel).accent }}>
          {riskTone(goal.riskLevel).label}
        </div>
      </div>

      <div className="goal-structure-rail">
        <div className="goal-structure-node">
          <div className={typeStyles.label} style={{ marginBottom: '6px', opacity: 0.54 }}>
            GOAL
          </div>
          <div style={{ fontFamily: 'var(--font-primary)', fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>
            {goal.title}
          </div>
        </div>

        <div className="goal-structure-node">
          <div className={typeStyles.label} style={{ marginBottom: '6px', opacity: 0.54 }}>
            MILESTONES
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.76)', letterSpacing: '0.08em' }}>
            {targetTypeLabel(goal.targetType)} | {formatProgressDetail(goal)}
          </div>
          <div className="body" style={{ fontSize: '13px', marginTop: '6px', opacity: 0.58 }}>
            {goal.deadline ? `Deadline lock: ${formatDeadline(goal.deadline)}` : 'No deadline lock. Execution is open-ended.'}
          </div>
        </div>

        <div className="goal-structure-node">
          <div className={typeStyles.label} style={{ marginBottom: '8px', opacity: 0.54 }}>
            TASKS
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {linkedTasks.length > 0 ? (
              linkedTasks.slice(0, 5).map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    alignItems: 'center',
                    fontFamily: 'var(--font-secondary)',
                    fontSize: '13px',
                    color: task.completed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.72)',
                  }}
                >
                  <span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</span>
                  <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)' }}>
                    {task.estimatedTime}M
                  </span>
                </div>
              ))
            ) : (
              <div className="body" style={{ fontSize: '13px', opacity: 0.58 }}>
                No execution tasks linked. Attach tasks to turn this target into a live pipeline.
              </div>
            )}
          </div>
        </div>

        <div className="goal-structure-node">
          <div className={typeStyles.label} style={{ marginBottom: '8px', opacity: 0.54 }}>
            ACTIONS
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {actionLines.map(line => (
              <div key={line} className="body" style={{ fontSize: '13px', opacity: 0.72 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SystemSurface>
  );
}

export default function Goals() {
  const goals = useGoalStore(state => state.goals);
  const deleteGoal = useGoalStore(state => state.deleteGoal);
  const tasks = useTaskStore(state => state.tasks);
  const entries = useDailyStore(state => state.entries);
  const [showWizard, setShowWizard] = useState(false);
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  const [lockedGoalId, setLockedGoalId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allEntries = useMemo(
    () => Object.values(entries).filter(entry => entry.completed) as DailyEntry[],
    [entries]
  );

  const goalMap = useMemo(() => computeAllGoals(goals, tasks, allEntries), [allEntries, goals, tasks]);
  const computedGoals = useMemo<GoalWithComputed[]>(
    () => goals.map(goal => goalMap[goal.id]).filter((goal): goal is GoalWithComputed => Boolean(goal)),
    [goalMap, goals]
  );

  const activeGoals = useMemo(
    () => computedGoals.filter(goal => goal.progress < 100).sort((left, right) => right.pressure - left.pressure),
    [computedGoals]
  );
  const completedGoals = useMemo(
    () => computedGoals.filter(goal => goal.progress >= 100).sort((left, right) => right.contributionScore - left.contributionScore),
    [computedGoals]
  );
  const engineInsights = useMemo(() => generateGoalInsights(goals, tasks, allEntries), [allEntries, goals, tasks]);
  const goalIntelligence = useMemo(
    () => buildGoalIntelligence(activeGoals.length > 0 ? activeGoals : computedGoals, tasks, engineInsights),
    [activeGoals, computedGoals, engineInsights, tasks]
  );

  const handleGoalHover = useCallback((goalId: string | null) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredGoalId(goalId), 40);
  }, []);

  const handleGoalSelect = useCallback((goalId: string) => {
    setLockedGoalId(current => (current === goalId ? null : goalId));
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLockedGoalId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeGoalId = lockedGoalId || hoveredGoalId;
  const focusedGoal = useMemo(
    () => computedGoals.find(goal => goal.id === activeGoalId) ?? activeGoals[0] ?? completedGoals[0] ?? null,
    [activeGoalId, activeGoals, completedGoals, computedGoals]
  );
  const alignment = useMemo(() => deriveAlignment(activeGoals), [activeGoals]);
  const primarySignal = focusedGoal?.progress ?? 0;
  const activeTargetCount = activeGoals.length;
  const primarySignalTone = focusedGoal ? riskTone(focusedGoal.riskLevel).accent : 'rgba(255,255,255,0.92)';
  const primarySignalLabel = focusedGoal ? focusedGoal.title : 'No targets locked';

  return (
    <>
      <div style={{ display: 'grid', gap: '24px' }}>
        <motion.section {...fadeInUp(0, 10)}>
          <div className={typeStyles.identityLabel} style={{ marginBottom: '10px' }}>
            SYSTEM ONLINE
          </div>
          <div className={typeStyles.hero}>GOALS MODE</div>
          <div className="body" style={{ marginTop: '10px', maxWidth: '420px', opacity: 0.62 }}>
            Targets define direction. Execution follows.
          </div>
        </motion.section>

        <SystemSurface as="section" interactive={false} delay={0.06} style={{ padding: '28px' }}>
          <div className="goals-hero-grid">
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className={typeStyles.label} style={{ opacity: 0.72 }}>ACTIVE TARGETS</div>
              <div className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.96)' }}>
                <AnimatedMetric value={activeTargetCount} />
              </div>
              <div className="body" style={{ fontSize: '13px', opacity: 0.54 }}>
                System target count remains visible even with zero active goals.
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '10px',
                justifyItems: 'center',
                textAlign: 'center',
                paddingInline: '8px',
              }}
            >
              <div className={typeStyles.label} style={{ opacity: 0.72 }}>PRIMARY GOAL SIGNAL</div>
              <div className="score-number" style={{ color: primarySignalTone }}>
                <AnimatedMetric value={primarySignal} />
                <span style={{ fontSize: '0.42em', marginLeft: '4px', color: 'rgba(255,255,255,0.42)' }}>%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  maxWidth: '260px',
                  height: '3px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${primarySignal}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: '100%',
                    borderRadius: '999px',
                    background: primarySignalTone,
                  }}
                />
              </div>
              <div className="body" style={{ fontSize: '13px', opacity: 0.58 }}>
                {primarySignalLabel}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px', justifyItems: 'end', textAlign: 'right' }}>
              <div className={typeStyles.label} style={{ opacity: 0.72 }}>SYSTEM ALIGNMENT</div>
              <div className="font-mono" style={{ fontSize: '24px', letterSpacing: '0.14em', color: alignment.accent }}>
                {alignment.label}
              </div>
              <div className="body" style={{ fontSize: '13px', opacity: 0.54, maxWidth: '220px' }}>
                {alignment.detail}
              </div>
            </div>
          </div>
        </SystemSurface>

        <div className="goals-layout-grid">
          <div style={{ display: 'grid', gap: '16px' }}>
            <motion.button
              type="button"
              {...fadeInUp(0.1, 10)}
              whileHover={{ ...surfaceInteraction.hover, backgroundColor: 'rgba(255,255,255,0.03)' }}
              whileTap={surfaceInteraction.tap}
              transition={uiMotion.fast}
              className="ifz14-card surface-base parallax-layer-2 goal-command-node"
              onClick={() => setShowWizard(true)}
            >
              <div className={typeStyles.label} style={{ opacity: 0.72, marginBottom: '10px' }}>
                PRIMARY ACTION
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.96)',
                  marginBottom: '10px',
                }}
              >
                + CREATE GOAL
              </div>
              <div className="body" style={{ fontSize: '13px', opacity: 0.58 }}>
                Define a target, link execution nodes, and let the system drive direction.
              </div>
            </motion.button>

            <motion.div {...fadeInUp(0.14, 10)}>
              <div className={typeStyles.label} style={{ marginBottom: '12px', opacity: 0.76 }}>
                ACTIVE TARGET QUEUE
              </div>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.16), rgba(255,255,255,0))', marginBottom: '16px' }} />
            </motion.div>

            {activeGoals.length > 0 ? (
              activeGoals.map((goal, index) => (
                <GoalMissionRow
                  key={goal.id}
                  goal={goal}
                  delay={0.16 + index * 0.05}
                  selected={lockedGoalId === goal.id}
                  onHover={handleGoalHover}
                  onSelect={handleGoalSelect}
                  onDelete={deleteGoal}
                />
              ))
            ) : (
              <SystemSurface as="section" interactive={false} delay={0.16} style={{ padding: '24px' }}>
                <div className="body" style={{ fontSize: '14px', opacity: 0.62 }}>
                  No goals defined. Create a target to give the system direction.
                </div>
              </SystemSurface>
            )}

            {completedGoals.length > 0 ? (
              <>
                <motion.div {...fadeInUp(0.26, 10)} style={{ marginTop: '8px' }}>
                  <div className={typeStyles.label} style={{ marginBottom: '12px', opacity: 0.56 }}>
                    COMPLETED TARGETS
                  </div>
                  <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0))', marginBottom: '16px' }} />
                </motion.div>
                {completedGoals.map((goal, index) => (
                  <GoalMissionRow
                    key={goal.id}
                    goal={goal}
                    delay={0.28 + index * 0.05}
                    selected={lockedGoalId === goal.id}
                    onHover={handleGoalHover}
                    onSelect={handleGoalSelect}
                    onDelete={deleteGoal}
                  />
                ))}
              </>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
            <GoalStructurePanel goal={focusedGoal} tasks={tasks} />
          </div>
        </div>

        <SystemSurface as="section" interactive={false} delay={0.28} style={{ padding: '28px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '14px', opacity: 0.76 }}>
            GOAL INTELLIGENCE
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {goalIntelligence.map(line => (
              <div key={line} className="goal-insight-line">
                {line}
              </div>
            ))}
          </div>
        </SystemSurface>
      </div>

      <AnimatePresence>
        {showWizard ? (
          <CreateGoalWizard
            onClose={(goalId) => {
              setShowWizard(false);
              if (goalId) {
                setLockedGoalId(goalId);
                setHoveredGoalId(null);
              }
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
