import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoDayStore } from '../stores/autoDayStore';
import { useDailyStore, BUILTIN_TEMPLATES } from '../stores/dailyStore';
import { useTaskStore } from '../stores/taskStore';
import { useGoalStore } from '../stores/goalStore';
import {
  generateDayPlan,
  determineAdaptiveQuestions,
  analyzeState,
} from '../engines/autoDayEngine';
import { generateSuggestions } from '../engines/suggestionEngine';
import { runAdaptation } from '../engines/adaptationEngine';
import { calculateStreaks } from '../engines/streakEngine';
import { computeAllGoals } from '../engines/goalEngine';
import SystemButton from './SystemButton';
import AnimatedMetric from './AnimatedMetric';
import type { AutoDayPrefillValues, DayBlock, DayTemplate, DailyEntry, GoalWithComputed, TemplateDefinition } from '../types';

interface AutoDayOverlayProps {
  onComplete: (template: DayTemplate, modeName: string, preFilled: AutoDayPrefillValues) => void;
  onCancel?: () => void;
}

const COMPUTING_STEPS = [
  'Analyzing patterns…',
  'Detecting risk signals…',
  'Allocating effort…',
  'Building your day…',
];

const DAY_TYPE_COLORS: Record<string, string> = {
  DOMINATION: '#fff',
  BUILD: 'rgba(255,255,255,0.8)',
  RECOVERY: 'rgba(255,255,255,0.6)',
  SALVAGE: 'rgba(255,255,255,0.5)',
};

export default function AutoDayOverlay({ onComplete, onCancel }: AutoDayOverlayProps) {
  const store = useAutoDayStore();
  const entries = useDailyStore(s => s.entries);
  const tasks = useTaskStore(s => s.tasks);
  const goals = useGoalStore(s => s.goals);
  const adaptationMode = useDailyStore(s => s.adaptationMode);
  const activeTemplateId = useDailyStore(s => s.activeTemplateId);
  const customTemplates = useDailyStore(s => s.customTemplates);
  const allEntries = (Object.values(entries) as DailyEntry[]) as DailyEntry[];
  const allCompleted = allEntries.filter(e => e.completed).sort((a, b) => a.date.localeCompare(b.date));
  const streaks = calculateStreaks(allCompleted);
  const suggestions = generateSuggestions(allCompleted, streaks);

  // ─── INIT: Determine questions on mount ───
  useEffect(() => {
    const analysis = allCompleted.length > 0 ? analyzeState(allCompleted) : null;
    const questions = determineAdaptiveQuestions(allCompleted, analysis);
    store.initiate(questions);
  }, []);

  const [currentQ, setCurrentQ] = useState(0);
  const [sliderVal, setSliderVal] = useState(5);
  const [detectedGoals, setDetectedGoals] = useState<GoalWithComputed[]>([]);

  useEffect(() => {
    const question = store.questions[currentQ];
    if (!question || question.type !== 'slider') return;
    const existing = store.userInputs[question.id as keyof typeof store.userInputs];
    if (typeof existing === 'number') setSliderVal(existing);
    else setSliderVal(typeof question.min === 'number' ? Math.max(question.min, 5) : 5);
  }, [currentQ, store.questions, store.userInputs]);

  // ─── Generate plan ───
  const runGeneration = useCallback(() => {
    store.setPhase('computing');
    store.setComputingStep(0);

    const stats = computeAllGoals(goals, tasks, allCompleted);
    const sorted = Object.values(stats).sort((a,b) => b.pressure - a.pressure);
    setDetectedGoals(sorted.filter(g => g.pressure >= 1).slice(0, 2));

    // Animate through computing steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      store.setComputingStep(step);
      if (step >= COMPUTING_STEPS.length) {
        clearInterval(interval);

        // Actually compute the plan
        const energy = store.userInputs.energy ?? 5;
        const sleep = store.userInputs.sleep ?? 7;

        const templateStructures: Record<string, DayTemplate> = {};
        Object.entries(BUILTIN_TEMPLATES).forEach(([k, v]) => {
          templateStructures[k] = v.structure;
        });

        let plan = generateDayPlan(allCompleted, tasks, goals, energy, sleep, templateStructures);

        // --- PHASE 4: ADAPTATION ENGINE ---
        if (adaptationMode === 'auto') {
           const currentTemplateDef =
             Object.values(BUILTIN_TEMPLATES).find((t: TemplateDefinition) => t.id === activeTemplateId) ||
             customTemplates.find((t: TemplateDefinition) => t.id === activeTemplateId) ||
             BUILTIN_TEMPLATES.execution;
           const streaks = calculateStreaks(allCompleted);
           const suggestions = generateSuggestions(allCompleted, streaks);
           const adaptations = runAdaptation(suggestions, currentTemplateDef);

           if (adaptations.summaryLog.length > 0) {
              if (adaptations.templateAdjustments?.recommendedSystemType) {
                 const newSys = adaptations.templateAdjustments.recommendedSystemType;
                 const targetTpl = Object.values(BUILTIN_TEMPLATES).find((t: TemplateDefinition) => t.systemType === newSys);
                 if (targetTpl) {
                     plan.template = [...targetTpl.structure];
                     plan.modeName = targetTpl.name;
                     plan.dayType = newSys.toUpperCase() as typeof plan.dayType;
                 }
              }

              if (adaptations.blockAdjustments.added.length > 0) {
                 adaptations.blockAdjustments.added.forEach(add => {
                    const newBlock: DayBlock = {
                        id: `block-${Math.random().toString(36).substring(2, 9)}`,
                        type: add.blockType,
                        title: add.customName || add.blockType.toUpperCase(),
                        weight: 1,
                        meta: { source: 'suggestion', createdAt: Date.now() }
                    };
                    if (add.customType) newBlock.customType = add.customType;
                    plan.template.push(newBlock);
                 });
              }

              if (adaptations.blockAdjustments.removed.length > 0) {
                 // Prevent execution block removals if they are locked or basic architecture
                 plan.template = plan.template.filter(b => !adaptations.blockAdjustments.removed.includes(b.id));
              }

              plan.adaptationLogs = adaptations.summaryLog;
           }
        }

        store.setPlan(plan);
      }
    }, 600);
  }, [allCompleted, tasks, goals, store, adaptationMode, activeTemplateId, customTemplates]);

  // ─── Handle question answers ───
  const handleAnswer = (key: string, value: string | number) => {
    store.setUserInput(key, value);
    if (currentQ < store.questions.length - 1) {
      setTimeout(() => setCurrentQ(c => c + 1), 200);
    } else {
      setTimeout(() => runGeneration(), 300);
    }
  };

  const handleSliderSubmit = () => {
    const q = store.questions[currentQ];
    handleAnswer(q.id, sliderVal);
  };

  // ─── Lock Day ───
  const handleLock = () => {
    if (!store.plan) return;
    store.lockDay();

    // Log Autonomous AI Adjustments
    if (store.plan.adaptationLogs?.length) {
       const logEvolution = useDailyStore.getState().logSystemEvolution;
       if (logEvolution) {
          store.plan.adaptationLogs.forEach(log => {
             logEvolution({ date: new Date().toISOString(), message: log, reason: 'Autonomous Correlation Filter' });
          });
       }
    }

    // Convert to DayBuilder-compatible preFilled
    const dwSessions = store.plan.deepWorkSessions.map(s => ({
      taskTitle: s.taskTitle,
      quality: 0,
    }));

    const preFilled: AutoDayPrefillValues = {
      dwSessions,
      dwQualities: dwSessions.map(() => 0),
    };

    onComplete(store.plan.template, store.plan.modeName, preFilled);
  };

  // ─── RENDER: Questions Phase ───
  if (store.phase === 'questions' && store.questions.length > 0) {
    const q = store.questions[currentQ];
    if (!q) {
      // All questions done, auto-trigger
      runGeneration();
      return null;
    }

    return (
      <motion.div
        className="autoday-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="autoday-glow" />

        {onCancel && false && (
          <button className="autoday-cancel-btn" onClick={() => { store.reset(); onCancel?.(); }}>
            CANCEL
          </button>
        )}

        <div className="autoday-center">
          {/* Progress */}
          <div className="autoday-stage-shell">
            <div className="task-wizard-topbar">
              <button
                type="button"
                onClick={() => setCurrentQ((index) => Math.max(0, index - 1))}
                disabled={currentQ === 0}
                className="task-wizard-nav task-wizard-nav-back"
              >
                <span className="task-wizard-nav-icon">&larr;</span>
                <span className="task-wizard-nav-text">Back</span>
              </button>
              <div className="wizard-label" style={{ justifySelf: 'center' }}>AUTO-DAY</div>
              {onCancel ? (
                <button className="task-wizard-nav task-wizard-nav-close" onClick={() => { store.reset(); onCancel(); }}>
                  <span className="task-wizard-nav-text">Close</span>
                  <span className="task-wizard-nav-icon">&times;</span>
                </button>
              ) : <div />}
            </div>
            <div className="autoday-phase-line">STATE: ACTIVE</div>
            <div className="wizard-label" style={{ marginBottom: '16px' }}>⚡ AUTO-DAY</div>
            <div className="task-wizard-progress" style={{ justifyContent: 'center' }}>
              {store.questions.map((_, i) => (
                <div key={i} className={`task-wizard-progress-segment ${i <= currentQ ? 'active' : 'inactive'}`} />
              ))}
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div className="task-wizard-question" style={{ marginBottom: '12px' }}>{q.title}</div>
              <div className="autoday-phase-reason">{q.reason}</div>

              {q.type === 'slider' && (
                <div className="autoday-slider-shell">
                  <div className="autoday-slider-axis">
                    <AnimatedMetric value={sliderVal} className="autoday-slider-value" />
                    <div className="autoday-slider-track">
                      <input
                        type="range"
                        min={q.min || 0}
                        max={q.max || 10}
                        step="0.5"
                        value={sliderVal}
                        onChange={e => setSliderVal(parseFloat(e.target.value))}
                        className="autoday-slider"
                      />
                      <div
                        className="autoday-slider-ticks"
                        aria-hidden="true"
                        style={{ gridTemplateColumns: `repeat(${(q.max || 10) - (q.min || 0) + 1}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: (q.max || 10) - (q.min || 0) + 1 }, (_, index) => {
                          const tickValue = (q.min || 0) + index;
                          return (
                            <span
                              key={tickValue}
                              className={`autoday-slider-tick ${sliderVal >= tickValue ? 'is-active' : ''}`}
                            >
                              {tickValue}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button className="autoday-submit-btn" onClick={handleSliderSubmit}>CONFIRM</button>
                </div>
              )}

              {q.type === 'select' && q.options && (
                <div className="task-wizard-option-stack">
                  {q.options.map((opt, index) => (
                    <motion.button
                      key={opt}
                      initial={{ opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.06 + index * 0.04, duration: 0.2 }}
                      className="task-wizard-option"
                      onClick={() => handleAnswer(q.id, opt)}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ─── RENDER: Computing Phase ───
  if (store.phase === 'computing' || store.phase === 'recalibrating') {
    return (
      <motion.div
        className="autoday-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="autoday-glow" />

        {onCancel && (
          <button className="autoday-cancel-btn" onClick={() => { store.reset(); onCancel(); }}>
            CANCEL
          </button>
        )}

        <div className="autoday-center">
          <div className="autoday-computing-container">
            <div className="autoday-computing-ring" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              {COMPUTING_STEPS.map((text, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: i <= store.computingStep ? 1 : 0.2, scale: 1 }}
                  transition={{ delay: i * 0.15, duration: 0.3 }}
                  style={{
                    fontSize: '13px',
                    letterSpacing: '0.08em',
                    color: i <= store.computingStep ? '#fff' : '#333',
                    transition: 'color 0.4s ease',
                  }}
                >
                  {i < store.computingStep ? '✓' : i === store.computingStep ? '›' : '·'} {text}
                </motion.div>
              ))}
            </div>

            {detectedGoals.length > 0 && store.computingStep >= 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center' }}
              >
                <div style={{ fontSize: '10px', color: '#fff', opacity: 0.7, letterSpacing: '0.15em', marginBottom: '8px', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>SYSTEM DETECTED</div>
                {detectedGoals.map(g => {
                  const level = g.pressure >= 6 ? 'HIGH' : g.pressure >= 3 ? 'MEDIUM' : 'LOW';
                  return (
                    <div key={g.id} style={{ fontSize: '13px', color: '#fff', marginBottom: '4px', letterSpacing: '0.02em' }}>
                      ⚠ {g.title} → {level} PRESSURE
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── RENDER: Preview Phase ───
  if (store.phase === 'preview' && store.plan) {
    const plan = store.plan;
    const typeColor = DAY_TYPE_COLORS[plan.dayType] || '#fff';

    return (
      <motion.div
        className="autoday-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ overflowY: 'auto' }}
      >
        <div className="autoday-glow" />

        {onCancel && (
          <button className="autoday-cancel-btn" onClick={() => { store.reset(); onCancel(); }}>
            CANCEL
          </button>
        )}

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '64px 24px', position: 'relative', zIndex: 10 }}>

          {/* Header */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <div className="wizard-label" style={{ marginBottom: '8px' }}>⚡ YOUR OPTIMAL DAY</div>

            {/* Day Type Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <div style={{
                fontSize: '32px', fontWeight: 400, letterSpacing: '0.08em', color: '#fff',
                fontFamily: 'var(--font-display)',
                textTransform: 'uppercase',
              }}>
                {plan.modeName}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
              <span className="autoday-badge" style={{ borderColor: typeColor, color: typeColor }}>{plan.dayType}</span>
              <span className="autoday-badge" style={{ borderColor: '#555' }}>
                CONFIDENCE {Math.round(plan.confidence * 100)}%
              </span>
            </div>
          </motion.div>

          {/* Prediction */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">PREDICTED OUTCOME</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <AnimatedMetric value={plan.prediction.expectedScore} className="metric-number-sm" />
              <span style={{ fontSize: '12px', letterSpacing: '0.15em', color: plan.prediction.trend === 'RISING' ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                {plan.prediction.trend} {plan.prediction.trend === 'RISING' ? '↑' : plan.prediction.trend === 'DECLINING' ? '↓' : '→'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', letterSpacing: '0.05em' }}>
              If you follow this plan
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">SYSTEM DECISIONS</div>
            <div className="autoday-decision-list">
              <div className="autoday-decision-row">
                <span className="autoday-decision-label">RECOMMENDED DEEP SESSIONS</span>
                <span className="autoday-decision-value">{plan.deepWorkSessions.length}</span>
              </div>
              <div className="autoday-decision-row">
                <span className="autoday-decision-label">OPTIMAL START</span>
                <span className="autoday-decision-value">{plan.deepWorkSessions[0]?.startTime || plan.wakeTime}</span>
              </div>
              <div className="autoday-decision-row">
                <span className="autoday-decision-label">BODY INTENSITY</span>
                <span className="autoday-decision-value">{plan.gymPlan.intensity.toUpperCase()}</span>
              </div>
            </div>
          </motion.div>

          {/* Wake & Sleep */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">TIME SYSTEM</div>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '4px' }}>WAKE</div>
                <div style={{ fontSize: '20px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{plan.wakeTime}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '4px' }}>SLEEP TARGET</div>
                <div style={{ fontSize: '20px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{plan.sleepTarget}h</div>
              </div>
            </div>
          </motion.div>

          {/* Deep Work Sessions */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">DEEP WORK — {plan.deepWorkSessions.length} SESSIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {plan.deepWorkSessions.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="autoday-session-num">{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#fff', letterSpacing: '0.02em' }}>{s.taskTitle}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', letterSpacing: '0.05em' }}>
                      {s.startTime} · {s.duration}m {(s.breakAfter || 0) > 0 ? `· ${s.breakAfter}m break` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Gym */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">BODY SYSTEM</div>
            <div style={{ fontSize: '14px', color: '#fff', textTransform: 'capitalize' }}>{plan.gymPlan.intensity} Intensity</div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', letterSpacing: '0.03em' }}>{plan.gymPlan.notes}</div>
          </motion.div>

          {/* Production */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 }}
            className="autoday-plan-card"
          >
            <div className="autoday-card-label">PRODUCTION TARGET</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{plan.productionTarget}</span>
              <span style={{ fontSize: '11px', color: '#555' }}>/ 100</span>
            </div>
          </motion.div>

          {/* Minimum Guarantee */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
            style={{ padding: '16px 20px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.08)', marginBottom: '16px' }}
          >
            <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#555', marginBottom: '6px' }}>MINIMUM GUARANTEE — NO ZERO DAYS</div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {plan.minimum.deepWorkSessions > 0 ? `${plan.minimum.deepWorkSessions} deep work session` : 'Light mental work'} + {plan.minimum.gymIntensity} gym
            </div>
          </motion.div>

          {/* Forced Reflection Notice */}
          {plan.forceReflection && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', marginBottom: '24px' }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: '#fff', opacity: 0.8, textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>REFLECTION REQUIRED — Decline trend detected</div>
            </motion.div>
          )}

          {/* System Adjustments (AUTO MODE BEHAVIOR) */}
          {plan.adaptationLogs && plan.adaptationLogs.length > 0 && (
            <motion.div
               initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.68 }}
               style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', marginBottom: '16px' }}
            >
               <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#fff', opacity: 0.8, marginBottom: '12px', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>SYSTEM ADJUSTMENTS AUTONOMOUSLY APPLIED</div>
               <ul style={{ margin: 0, paddingLeft: '16px', color: '#fff', fontSize: '12px', lineHeight: 1.6 }}>
                 {plan.adaptationLogs.map((log, i) => (
                   <li key={i}>{log}</li>
                 ))}
               </ul>
            </motion.div>
          )}

          {/* AI Suggestions inside Preview (ASSIST/MANUAL MODE) */}
          {suggestions.length > 0 && adaptationMode !== 'auto' && (
            <motion.div
               initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.68 }}
               style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)', marginBottom: '16px' }}
            >
               <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#fff', opacity: 0.7, marginBottom: '12px', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>AI OPTIMIZATION AVAILABLE</div>
               {suggestions.slice(0, 2).map((sig, i) => (
                 <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i === 0 ? '12px' : 0 }}>
                   <div>
                     <div style={{ fontSize: '13px', color: '#fff', letterSpacing: '0.02em', lineHeight: 1.4 }}>{sig.message}</div>
                     <div style={{ fontSize: '10px', color: '#00ff88', marginTop: '6px', letterSpacing: '0.1em' }}>+{sig.impact}% EST SCORE IMPACT</div>
                   </div>
                   <button 
                     onClick={() => store.openBuilder(plan)}
                     style={{ padding: '8px 16px', fontSize: '10px', background: '#00ff88', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer' }}
                   >
                     AUTO-FIX
                   </button>
                 </div>
               ))}
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}
            style={{ display: 'flex', gap: '16px', marginTop: '32px' }}
          >
            <SystemButton variant="primary" onClick={handleLock}>
              LOCK DAY
            </SystemButton>
            <SystemButton
              variant="ghost"
              onClick={() => {
                store.openBuilder(plan);
              }}
            >
              EDIT
            </SystemButton>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Fallback for idle or unknown states
  return null;
}
