import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import SystemButton from '../../../components/SystemButton';
import { calculateScore } from '../../../engines/scoreEngine';
import type { DailyEntry } from '../../../types';
import { type as typeStyles } from '../../../typography';
import { SectionTitle } from './DailyPrimitives';

type ReflectionQuestion = {
  id: string;
  title: string;
  options?: string[];
  color?: string;
  isInput?: boolean;
};

type StableReflectionBlockProps = {
  entry: DailyEntry;
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
};

export function StableReflectionBlock({ entry, update, visual }: StableReflectionBlockProps) {
  const [status, setStatus] = useState<'idle' | 'active' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const refData = entry.dynamic_values?.reflection || {};
  const reflectionAnswers = refData as Record<string, string | undefined>;
  const reflectionStarted = Object.keys(refData).length > 0;
  const hasDeepWork = entry.structure_snapshot?.some((block) => block.type === 'deep_work') || false;
  const hasBody = entry.structure_snapshot?.some((block) => block.type === 'body') || false;
  const { score } = calculateScore(entry);

  const setRef = (key: string, value: string) => {
    update({ dynamic_values: { ...entry.dynamic_values, reflection: { ...refData, [key]: value } } });
  };

  const questions = useMemo(() => {
    const items: ReflectionQuestion[] = [];

    if (hasDeepWork) {
      items.push({ id: 'deepWork', title: 'Did you complete your deep work sessions?', options: ['All', 'Partial', 'None'] });
    }

    items.push({ id: 'tasks', title: 'Were your planned tasks completed?', options: ['Yes', 'Mostly', 'No'] });

    if (hasBody) {
      items.push({ id: 'body', title: 'Was your body system completed?', options: ['Yes', 'No'] });
    }

    items.push({ id: 'energy', title: 'How was your energy today?', options: ['Low', 'Stable', 'High'] });

    if (refData.deepWork === 'Partial' || refData.deepWork === 'None') {
      items.push({ id: 'deepWorkFailure', title: 'What blocked your deep work?', options: ['DISTRACTION', 'LOW_ENERGY', 'OVERLOAD', 'NO_CLARITY'], color: '#fff' });
    }

    if (refData.energy === 'Low') {
      items.push({ id: 'energyDropReason', title: 'Why was your energy low?', options: ['SLEEP', 'STRESS', 'DIET', 'UNKNOWN'], color: 'rgba(255,255,255,0.8)' });
    }

    if (refData.deepWork === 'None' && !refData.deepWorkFailure) {
      items.push({ id: 'followUpReason', title: 'Why was deep work skipped?', options: ['Time issue', 'Low energy', 'Distraction'], color: '#fff' });
    } else if (score < 50 && (refData.deepWork || refData.tasks)) {
      items.push({ id: 'followUpReason', title: 'What limited your performance?', options: ['Sleep', 'Focus', 'Planning'], color: 'rgba(255,255,255,0.8)' });
    } else if (score >= 80 && (refData.deepWork || refData.tasks)) {
      items.push({ id: 'followUpReason', title: 'What worked well today?', options: ['Focus', 'Structure', 'Energy'], color: '#fff' });
    }

    items.push({ id: 'note', title: 'Anything worth sharing?', isInput: true });
    return items;
  }, [hasBody, hasDeepWork, refData.deepWork, refData.deepWorkFailure, refData.energy, refData.tasks, score]);

  const currentQ = step < questions.length ? questions[step] : null;
  const reflectionComplete = questions.every((question) => question.isInput ? true : Boolean(reflectionAnswers[question.id]));

  useEffect(() => {
    if (status === 'active' && step >= questions.length) {
      const timer = setTimeout(() => {
        setStep(0);
        setStatus('done');
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [questions.length, status, step]);

  useEffect(() => {
    document.body.style.overflow = status === 'active' ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [status]);

  const openReflection = () => {
    setStep(0);
    setStatus('active');
  };

  const closeReflection = () => {
    setStep(0);
    setStatus(reflectionComplete || reflectionStarted ? 'done' : 'idle');
  };

  const handleAnswer = (id: string, value: string) => {
    setRef(id, value);
    setTimeout(() => {
      setStep((current) => current + 1);
    }, 160);
  };

  return (
    <>
      <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
        <SectionTitle text="REFLECTION" i={4} />
        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {(status === 'done' || reflectionStarted) ? (
            <div className={typeStyles.body} style={{ color: '#8a8a8a' }}>Reflection ready.</div>
          ) : null}
          <SystemButton variant="secondary" onClick={openReflection}>
            {reflectionStarted ? 'CONTINUE' : 'INITIATE'}
          </SystemButton>
        </div>
      </section>

      <AnimatePresence>
        {status === 'active' && currentQ ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-modal)',
              background: 'rgba(0,0,0,0.94)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at center, rgba(255,255,255,0.04), transparent 70%)' }} />

            <div className="reflection-wizard-shell" style={{ position: 'relative', width: '100%', maxWidth: '640px', minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: 'translateY(-5%)' }}>
              <div className="reflection-wizard-column reflection-wizard-top" style={{ width: '100%', maxWidth: '560px', marginBottom: '52px' }}>
                <div className="task-wizard-topbar reflection-topbar">
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    disabled={step === 0}
                    className="task-wizard-nav task-wizard-nav-back"
                  >
                    <span className="task-wizard-nav-icon">&larr;</span>
                    <span className="task-wizard-nav-text">Back</span>
                  </button>
                  <div className="wizard-label" style={{ justifySelf: 'center' }}>REFLECTION</div>
                  <button
                    type="button"
                    onClick={closeReflection}
                    className="task-wizard-nav task-wizard-nav-close"
                  >
                    <span className="task-wizard-nav-text">Close</span>
                    <span className="task-wizard-nav-icon">&times;</span>
                  </button>
                </div>
                <div className="task-wizard-progress" style={{ justifyContent: 'center' }}>
                  {questions.map((_, index) => (
                    <div key={index} className={`task-wizard-progress-segment ${index <= step ? 'active' : 'inactive'}`} />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  className="reflection-wizard-column reflection-question-column wizard-question-gap"
                >
                  <div className="task-wizard-question reflection-question" style={{ color: currentQ.color || '#fff', marginBottom: '12px' }}>
                    {currentQ.title}
                  </div>
                  <div className="task-wizard-prompt reflection-prompt" style={{ marginBottom: '18px' }}>
                    System interrogation active. Respond to move the day log forward.
                  </div>

                  {currentQ.isInput ? (
                    <div className="reflection-option-stack wizard-option-gap" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <div className="task-wizard-input-shell" style={{ maxWidth: '420px' }}>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Short insight..."
                          value={refData.note || ''}
                          onChange={(e) => setRef('note', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setStep((current) => current + 1);
                          }}
                          className="task-wizard-input reflection-input"
                        />
                        <div className="task-wizard-input-line" />
                      </div>
                      <SystemButton variant="secondary" onClick={() => setStep((current) => current + 1)}>
                        CAPTURE
                      </SystemButton>
                    </div>
                  ) : (
                    <div className="task-wizard-option-stack reflection-option-stack wizard-option-gap">
                      {currentQ.options?.map((opt) => {
                        const isActive = reflectionAnswers[currentQ.id] === opt;
                        const hasAnswer = !!reflectionAnswers[currentQ.id];
                        return (
                          <motion.button
                            key={opt}
                            initial={{ opacity: 0, scale: 0.985 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.06, duration: 0.2 }}
                            className={`task-wizard-option ${isActive ? 'selected' : hasAnswer ? 'task-wizard-option-muted' : ''}`}
                            onClick={() => handleAnswer(currentQ.id, opt)}
                          >
                            {opt}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
