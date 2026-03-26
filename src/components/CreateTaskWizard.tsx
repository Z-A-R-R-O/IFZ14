import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../stores/taskStore';
import { useGoalStore } from '../stores/goalStore';
import { motionTiming } from '../motion';
import { type as typeStyles } from '../typography';
import type { Task, TaskEnergyType } from '../types';

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

export function CreateTaskWizard({ onClose }: { onClose: (taskId?: string) => void }) {
  const addTask = useTaskStore((s) => s.addTask);
  const goals = useGoalStore((s) => s.goals);
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
    setStep((currentStep) => Math.max(0, currentStep - 1));
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
            onChange={(e) => {
              setCloseArmed(false);
              setData({ ...data, title: e.target.value });
            }}
            onKeyDown={(e) => {
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
          {(['deep', 'light', 'quick'] as const).map((energyType) => (
            <motion.button
              key={energyType}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.energyType === energyType ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, energyType });
                queueStep(2, 190);
              }}
            >
              <span className="task-wizard-option-kicker">MODE</span>
              {energyType === 'deep' ? 'DEEP WORK' : energyType === 'light' ? 'LIGHT WORK' : 'QUICK TASK'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'ESTIMATED TIME',
      render: () => (
        <div className="task-wizard-option-stack">
          {[15, 30, 45, 60, 90, 120].map((minutes) => (
            <motion.button
              key={minutes}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.estimatedTime === minutes ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, estimatedTime: minutes });
                queueStep(3, 180);
              }}
            >
              <span className="task-wizard-option-kicker">WINDOW</span>
              {minutes < 60 ? `${minutes}m` : `${minutes / 60}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'PRIORITY',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['HIGH', 'MED', 'LOW'] as const).map((priority) => (
            <motion.button
              key={priority}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.priority === priority ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, priority });
                queueStep(goals.length > 0 ? 4 : 5, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LEVEL</span>
              {priority === 'HIGH' ? 'HIGH' : priority === 'MED' ? 'MEDIUM' : 'LOW'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'LINKED GOAL (OPTIONAL)',
      render: () => (
        <div className="task-wizard-option-stack">
          {goals.map((goal) => (
            <motion.button
              key={goal.id}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.goalId === goal.id ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, goalId: goal.id });
                queueStep(5, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LINK</span>
              {goal.title}
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
          {(['morning', 'afternoon', 'night'] as const).map((preferredTime) => (
            <motion.button
              key={preferredTime}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.preferredTime === preferredTime ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, preferredTime });
                queueStep(6, 180);
              }}
            >
              <span className="task-wizard-option-kicker">SYNC</span>
              {preferredTime === 'morning' ? 'MORNING' : preferredTime === 'afternoon' ? 'AFTERNOON' : 'NIGHT'}
            </motion.button>
          ))}
        </div>
      ),
    },
    {
      title: 'HOW HEAVY IS IT?',
      render: () => (
        <div className="task-wizard-option-stack">
          {(['low', 'medium', 'high'] as const).map((energyDemand) => (
            <motion.button
              key={energyDemand}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.986 }}
              transition={motionTiming.fast}
              className={`wizard-option task-wizard-option ${data.energyDemand === energyDemand ? 'selected' : ''}`}
              onClick={() => {
                setData({ ...data, energyDemand });
                queueStep(7, 180);
              }}
            >
              <span className="task-wizard-option-kicker">LOAD</span>
              {energyDemand === 'low' ? 'LOW' : energyDemand === 'medium' ? 'MEDIUM' : 'HIGH'}
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
              onChange={(e) => {
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
              <span className="task-wizard-nav-icon">â†</span>
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
              <span className="task-wizard-nav-icon">Ã—</span>
            </motion.button>
          </div>
          <div className="task-wizard-progress" style={{ justifyContent: 'center' }}>
            {steps.map((_, index) => (
              <motion.div
                key={index}
                className={`task-wizard-progress-segment ${index <= step ? 'active' : 'inactive'}`}
                initial={false}
                animate={{
                  opacity: index <= step ? 1 : 0.42,
                  scaleY: index === step ? 1.4 : 1,
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
