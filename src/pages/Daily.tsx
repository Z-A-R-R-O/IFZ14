import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useDailyStore } from '../stores/dailyStore';
import { useAutoDayStore } from '../stores/autoDayStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { calculateScore } from '../engines/scoreEngine';
import { detectPattern } from '../engines/patternEngine';
import { addDays, format, isToday, subDays } from 'date-fns';
import type { DailyEntry, DayBlock } from '../types';
import { createEmptyEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { CreateTaskWizard } from './Tasks';
import AnimatedMetric from '../components/AnimatedMetric';
import SystemButton from '../components/SystemButton';
import { formatHeadingText, type as typeStyles } from '../typography';
import { dashboardSequence, motionTiming } from '../motion';
import { normalizeModeName } from '../lib/modeName';

function useDebounce(fn: (...args: unknown[]) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]);
}

/* ─── Atomic UI Components ─── */

function SignalValue({
  value,
  suffix = '',
  className = 'metric-number-xs',
  pulse = true,
}: {
  value: number | string | null | undefined;
  suffix?: string;
  className?: string;
  pulse?: boolean;
}) {
  if (value === undefined || value === null || value === '') {
    return <span className={className}>--</span>;
  }

  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value))) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
        <AnimatedMetric value={value} className={className} pulse={pulse} />
        {suffix ? <span className={typeStyles.label}>{suffix}</span> : null}
      </span>
    );
  }

  return <span className={className}>{String(value)}</span>;
}

function SectionTitle({ text, i }: { text: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="daily-section-title heading-sm text-[13px] text-white"
    >
      {formatHeadingText(text)}
    </motion.div>
  );
}

function SignalRow({
  label,
  value,
  onClick,
  isEmpty = false,
  editable = false,
  i = 0,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  isEmpty?: boolean;
  editable?: boolean;
  i?: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.35 }}
      className={`daily-signal-row${editable ? ' is-editable' : ''}${isEmpty ? ' is-empty' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={typeStyles.label}>{label}</span>
      <span className="daily-signal-value">{value}</span>
      {editable ? <span className="daily-signal-underline" /> : null}
    </motion.button>
  );
}

function DotToggleRow({ label, active, onToggle, i = 0 }: any) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.35 }}
      className="daily-dot-toggle-row"
      onClick={onToggle}
    >
      <span className={typeStyles.label}>{label}</span>
      <span className={`daily-dot-toggle${active ? ' is-active' : ''}`} aria-hidden="true" />
    </motion.button>
  );
}

function TextAreaField({ label, value, onChange, placeholder, i = 0, typing = false }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="daily-field">
      {label && <div className="daily-field-head"><div className={typeStyles.label}>{label}</div></div>}
      <div className="daily-input-shell">
        <textarea
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`daily-textarea font-secondary text-[14px] ${typing ? 'daily-textarea-typing' : ''}`}
        />
        <div className="daily-input-line" />
      </div>
    </motion.div>
  );
}

/* ─── Block Renderers ─── */

function WakeBlock({ entry, update, visual }: any) {
  const wakeValue = entry.actualWakeTime || entry.values?.actualWakeTime || '';
  const sleepValue = entry.totalSleepHours || entry.values?.totalSleepHours || 0;
  const sleepInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isWakePickerOpen, setIsWakePickerOpen] = useState(false);

  const parseWakeParts = useMemo(() => {
    const [rawHour, rawMinute] = (wakeValue || '07:00').split(':').map((part: string) => parseInt(part, 10));
    const safeHour = Number.isFinite(rawHour) ? rawHour : 7;
    const safeMinute = Number.isFinite(rawMinute) ? rawMinute : 0;
    const period: 'AM' | 'PM' = safeHour >= 12 ? 'PM' : 'AM';
    const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
    return { hour12, minute: safeMinute, period };
  }, [wakeValue]);

  useEffect(() => {
    if (!isWakePickerOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsWakePickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isWakePickerOpen]);

  const setWakeTime = (hour12: number, minute: number, period: 'AM' | 'PM') => {
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    const formatted = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    update({ actualWakeTime: formatted });
  };

  const displayWakeValue = wakeValue || '00:00';

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="WAKE SYSTEM" i={0} />
      <div className="daily-signal-panel">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 * 0.04, duration: 0.35 }} className="daily-wake-picker-shell" ref={pickerRef}>
          <button
            type="button"
            className={`daily-signal-row daily-wake-trigger${!wakeValue ? ' is-empty' : ''}${isWakePickerOpen ? ' is-open' : ''}`}
            onClick={() => setIsWakePickerOpen((open) => !open)}
          >
            <span className={typeStyles.label}>WAKE TIME</span>
            <span className="daily-signal-value">
              <span className={`daily-time-readout${!wakeValue ? ' is-empty' : ''}`}>{displayWakeValue}</span>
            </span>
            <span className="daily-signal-underline" />
          </button>

          <AnimatePresence>
            {isWakePickerOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="daily-wake-picker-panel"
              >
                <div className="daily-wake-picker-grid">
                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>HOUR</span>
                    <div className="daily-wake-picker-list">
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.hour12 === hour ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(hour, parseWakeParts.minute, parseWakeParts.period)}
                        >
                          {String(hour).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>MIN</span>
                    <div className="daily-wake-picker-list">
                      {[0, 15, 30, 45].map((minute) => (
                        <button
                          key={minute}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.minute === minute ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(parseWakeParts.hour12, minute, parseWakeParts.period)}
                        >
                          {String(minute).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="daily-wake-picker-col daily-wake-picker-col--period">
                    <span className={typeStyles.label}>ZONE</span>
                    <div className="daily-wake-picker-list">
                      {(['AM', 'PM'] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.period === period ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(parseWakeParts.hour12, parseWakeParts.minute, period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <SignalRow
          label="SLEEP"
          value={<SignalValue value={sleepValue > 0 ? sleepValue : '--'} suffix={sleepValue > 0 ? 'H' : ''} className="metric-number-sm" pulse={sleepValue > 0} />}
          onClick={() => sleepInputRef.current?.focus()}
          editable
          i={2}
        />
        <input
          ref={sleepInputRef}
          type="number"
          step="0.1"
          min="0"
          value={sleepValue || ''}
          onChange={(e) => update({ totalSleepHours: parseFloat(e.target.value) || 0 })}
          className="daily-signal-hidden-input"
          aria-label="Sleep hours"
        />
      </div>
    </section>
  );
}

function BodyBlock({ entry, update, visual }: any) {
  const gym = entry.gymTraining || entry.values?.gymTraining;
  const jaw = entry.jawlineWorkout !== undefined ? entry.jawlineWorkout : entry.values?.jawlineWorkout;
  const energy = entry.energyLevel || entry.values?.energyLevel;
  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="BODY SYSTEM" i={1} />
      <div className="daily-signal-panel">
        <DotToggleRow label="GYM" active={gym === 'completed'} onToggle={() => update({ gymTraining: gym === 'completed' ? 'skipped' : 'completed' })} i={3} />
        <DotToggleRow label="JAW" active={!!jaw} onToggle={() => update({ jawlineWorkout: !jaw })} i={4} />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5 * 0.04, duration: 0.35 }} className="daily-energy-panel">
          <div className="daily-energy-head">
            <span className={typeStyles.label}>ENERGY</span>
            <SignalValue value={energy || '--'} className="metric-number-sm" pulse={Boolean(energy)} />
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={energy || 5}
            onChange={(e) => update({ energyLevel: Math.min(10, Math.max(1, parseInt(e.target.value) || 5)) })}
            className="daily-energy-slider"
            aria-label="Energy level"
          />
          <div className="daily-energy-ticks" aria-hidden="true">
            {Array.from({ length: 10 }, (_, idx) => (
              <span key={idx} className={`daily-energy-tick${(energy || 5) > idx ? ' is-active' : ''}`} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DeepWorkSessionRow({
  session, idx, tasks, unassigned, updateSession, removeSession, splitSession, canRemove, onStartCreate, isLast
}: {
  session: any, idx: number, tasks: any[], unassigned: any[],
  updateSession: (idx: number, updates: any) => void,
  removeSession: (idx: number) => void,
  splitSession: (idx: number) => void,
  canRemove: boolean,
  onStartCreate: () => void,
  isLast?: boolean
}) {
  const addCompletedTime = useTaskStore(s => s.addCompletedTime);
  const goals = useGoalStore(s => s.goals);
  const [isOpen, setIsOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const focus = parseInt(session.focus) || parseInt(session.quality) || 0;
  const prevFocus = useRef(focus);

  // Edge-triggered completion
  useEffect(() => {
    if (prevFocus.current <= 40 && focus > 40 && session.taskId && !session.isCompleted) {
      updateSession(idx, { isCompleted: true, status: 'done' });
      addCompletedTime(session.taskId, session.duration || 60);
    }
    // (One-way completion binding prevents accidental negative time removal edge cases)
    prevFocus.current = focus;
  }, [focus, session.taskId, idx, updateSession, session.isCompleted, session.duration, addCompletedTime]);

  const linked = session.taskId ? tasks.find(t => t.id === session.taskId) : null;
  const hasTask = Boolean(linked || session.taskTitle);
  const isLocked = Boolean(session.isLocked && hasTask);
  const canCreateTask = !isLocked;
  const clearTask = () => {
    updateSession(idx, {
      taskId: undefined,
      taskTitle: '',
      isLocked: false,
      isCompleted: false,
      status: focus > 0 ? 'active' : 'pending',
    });
    setIsOpen(false);
  };
  const toggleLock = () => {
    if (!hasTask) return;
    updateSession(idx, { isLocked: !isLocked });
    setIsOpen(false);
  };
  // Compute display status for timeline badge
  const displayStatus = (() => {
    if (session.isCompleted || session.status === 'done') return 'completed';
    if (focus > 0 || session.status === 'active') return 'active';
    // Delay detection: if session has a startTime and current time has passed it
    if (session.startTime) {
      const now = new Date();
      const [h, m] = (session.startTime as string).split(':').map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(h, m, 0, 0);
      if (now > scheduledDate && session.status === 'pending') return 'active';
    }
    return 'upcoming';
  })();

  const statusConfig: Record<string, { color: string; bg: string; label: string; border: string; textShadow?: string }> = {
    upcoming: { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.015)', label: 'UPCOMING', border: 'rgba(255,255,255,0.08)' },
    active: { color: '#fff', bg: 'rgba(255,255,255,0.035)', label: 'ACTIVE', border: 'rgba(255,255,255,0.22)', textShadow: '0 0 8px rgba(255,255,255,0.12)' },
    completed: { color: '#5A5A5A', bg: 'rgba(255,255,255,0.01)', label: 'DONE', border: 'rgba(255,255,255,0.04)' },
  };
  const badge = statusConfig[displayStatus] || statusConfig.upcoming;

  // Compute endTime from startTime + duration
  const endTime = (() => {
    if (!session.startTime) return null;
    const [h, m] = (session.startTime as string).split(':').map(Number);
    const totalMin = h * 60 + m + (session.duration || 60);
    return `${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`;
  })();
  return (
    <motion.div className={`session-row daily-session-row is-${displayStatus}${isLast ? ' is-last' : ''}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }} whileHover={{ y: -2 }} transition={{ delay: idx * 0.04, duration: 0.3 }} layout
      style={{ background: badge.bg, marginBottom: '8px', ['--session-accent' as any]: badge.color, ['--session-border' as any]: badge.border }}>
      
      {/* Timeline header: time range + status badge */}
      <div className="daily-session-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingTop: '4px' }}>
        <span className="font-mono text-[11px] uppercase daily-session-time-value" style={{ fontWeight: 600, color: badge.color }}>
          {session.startTime ? `${session.startTime}${endTime ? ` – ${endTime}` : ''}` : `SESSION ${idx + 1}`}
        </span>
        <span className="font-mono text-[10px] uppercase daily-session-state-hint" style={{ color: badge.color, opacity: 0.8, textShadow: badge.textShadow }}>
          {badge.label}
        </span>
      </div>

      <div className="daily-session-main" style={{ display: 'flex', gap: '8px' }}>
        <div className="daily-session-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="daily-session-unit-header">
          <button
            type="button"
            className={`daily-session-lock-btn${isLocked ? ' is-active' : ''}${!hasTask ? ' is-disabled' : ''}`}
            onClick={toggleLock}
            title={isLocked ? 'Unlock session' : 'Lock session'}
          >
            {isLocked ? '[ LOCK ]' : '[ OPEN ]'}
          </button>
        </div>
        {/* Custom Task Selector Dropdown */}
        <div className={`dw-dropdown daily-session-selector-shell${isLocked ? ' is-locked' : ''}`} style={{ position: 'relative', width: '100%' }}>
          <div 
            className={`dw-trigger daily-session-selector${isLocked ? ' is-locked' : ''}`} 
            onClick={() => { if (!isLocked) setIsOpen(!isOpen); }}
            style={{
               background: 'rgba(255, 255, 255, 0.032)', border: '1px solid rgba(255,255,255,0.05)',
               backdropFilter: 'blur(10px)', padding: '10px 12px', borderRadius: '10px', color: session.status === 'done' ? '#5A5A5A' : '#fff',
               fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
               alignItems: 'center', textDecoration: session.status === 'done' ? 'line-through' : 'none',
               marginTop: '6px', transition: 'border-color 0.2s ease, transform 0.18s ease, box-shadow 0.18s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span className="font-primary text-[14px] daily-session-selector-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
               {linked ? linked.title : session.taskTitle ? session.taskTitle : 'Select Task'}
            </span>
            {!isLocked && <span className="daily-session-selector-arrow" style={{ opacity: 0.5, fontSize: '10px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>+</span>}
            {hasTask && (
              <button
                type="button"
                className="daily-session-clear-btn"
                onClick={(e) => { e.stopPropagation(); clearTask(); }}
                title="Remove task"
              >
                CLEAR
              </button>
            )}
          </div>

          <AnimatePresence>
            {!isLocked && isOpen && (
              <>
                {/* Invisible backdrop to catch clicks outside */}
                <div 
                   style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                   onClick={() => setIsOpen(false)}
                />
                <motion.div 
                   className="dw-menu"
                   initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
                   style={{
                     position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                     background: 'rgba(15,15,15,0.82)', border: '1px solid rgba(255,255,255,0.07)',
                     backdropFilter: 'blur(16px)', borderRadius: '8px', padding: '8px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.38)',
                     maxHeight: '240px', overflowY: 'auto'
                   }}
                >
                   {canCreateTask && (
                     <div 
                        onClick={() => { onStartCreate(); setIsOpen(false); }}
                        className="font-primary-bold text-[12px] uppercase daily-session-menu-command"
                        style={{ padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.82)', cursor: 'pointer', borderRadius: '6px', marginBottom: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                     >
                        CREATE TASK
                     </div>
                   )}

                   {unassigned.length > 0 && <div className={typeStyles.label} style={{ color: '#555', padding: '8px 12px 4px 12px' }}>SMART SUGGESTIONS</div>}
                   {unassigned.map(t => (
                     <div 
                       key={t.id}
                       onClick={() => { updateSession(idx, { taskId: t.id, taskTitle: t.title, isLocked: false }); setIsOpen(false); }}
                       style={{ 
                          padding: '8px 12px', fontSize: '13px', color: '#fff', cursor: 'pointer', borderRadius: '6px',
                          display: 'flex', justifyContent: 'space-between'
                       }}
                       onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                     >
                        <span className="font-primary text-[13px]" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                       </span>
                        <span className="font-mono text-[11px]" style={{ color: '#555', marginLeft: '8px', letterSpacing: '0.08em' }}>
                          {String(t.priority || '').toUpperCase()} · {t.estimatedTime}M
                        </span>
                     </div>
                   ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {linked && (
          <div className="daily-session-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '-4px' }}>
            <span className="font-mono text-[10px] uppercase daily-session-meta-item" style={{ color: '#5A5A5A', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⏱ 
              <input 
                type="number" 
                value={session.duration || 60}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  updateSession(idx, { duration: val });
                }}
                disabled={session.isCompleted}
                className="font-mono daily-session-duration-input"
                style={{
                  background: 'transparent', border: 'none', color: session.isCompleted ? '#5A5A5A' : '#bfbfbf',
                  width: '32px', fontSize: '10px', outline: 'none', borderBottom: session.isCompleted ? 'none' : '1px solid rgba(255,255,255,0.2)'
                }}
              />
              m
            </span>
            <span className={`font-mono text-[10px] uppercase daily-session-meta-item priority-${String(linked.priority || '').toLowerCase()}`} style={{ color: linked.priority === 'HIGH' ? '#ffb347' : '#5A5A5A' }}>
              {linked.priority}
            </span>
            {(() => {
              const linkedGoal = linked?.goalId ? goals.find(g => g.id === linked.goalId) : null;
              if (!linkedGoal) return null;
              
              let impact = 0;
              if (linkedGoal.targetType === 'task_count') {
                impact = (1 / linkedGoal.targetValue) * 100;
              } else if (linkedGoal.targetType === 'time') {
                impact = ((session.duration || 60) / linkedGoal.targetValue) * 100;
              }
              const impactStr = impact > 0 ? ` (+${impact >= 1 ? Math.round(impact) : impact.toFixed(1)}%)` : '';

              return (
                <span className="goal-impact-badge daily-session-goal-link font-primary text-[10px]" style={{ color: '#4ade80', letterSpacing: '0.04em', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', padding: '3px 8px', borderRadius: '4px', marginLeft: 'auto' }}>
                  → {linkedGoal.title}{impactStr}
                </span>
              );
            })()}
          </div>
        )}

        <div className="daily-session-focus-stack">
          <span className={typeStyles.label}>FOCUS</span>
          <SignalValue value={focus || 0} className="metric-number-sm daily-session-focus-value" pulse={focus > 0} />
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={focus}
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
              updateSession(idx, { focus: val, quality: val });
            }}
            className="daily-energy-slider daily-session-focus-slider"
            aria-label={`Session ${idx + 1} focus`}
          />
          <div className="daily-energy-ticks daily-session-focus-ticks" aria-hidden="true">
            {Array.from({ length: 11 }, (_, tickIndex) => (
              <span key={tickIndex} className={`daily-energy-tick${focus >= tickIndex * 10 ? ' is-active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Task progress bar */}
        {linked && (linked.completedTime || 0) > 0 && (
          <div className="daily-session-progress" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#5A5A5A', letterSpacing: '0.06em' }}>
            <div className="daily-session-progress-track" style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="daily-session-progress-fill" style={{ width: `${Math.min(100, ((linked.completedTime || 0) / Math.max(linked.estimatedTime, 1)) * 100)}%`, height: '100%', background: badge.color, borderRadius: '2px', transition: 'width 0.3s ease' }} />
            </div>
            <span className="daily-session-progress-value">{linked.completedTime || 0} / {linked.estimatedTime}m</span>
          </div>
        )}
        </div>

      <div className="session-actions daily-session-actions" style={{ paddingTop: '6px', position: 'relative' }}>
        <button 
           className="session-action-btn" 
           style={{ color: '#fff', opacity: 0.5 }}
           onClick={() => setShowActions(!showActions)}
           title="Actions"
        >
           ⋯
        </button>
        
        <AnimatePresence>
           {showActions && (
             <>
               <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowActions(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="system-action-menu"
                 style={{ 
                   position: 'absolute', right: '100%', top: '0', marginRight: '8px',
                   zIndex: 100, width: '140px'
                 }}
                >
                 {hasTask && (
                   <button 
                     className="system-action-menu-item"
                     onClick={(e) => { e.stopPropagation(); clearTask(); setShowActions(false); }}
                   >
                      RESET TASK
                   </button>
                 )}
                 <button 
                   className="system-action-menu-item"
                   onClick={(e) => { e.stopPropagation(); splitSession(idx); setShowActions(false); }}
                   disabled={session.isCompleted}
                 >
                    SPLIT
                 </button>
                 {canRemove && (
                   <button 
                     className="system-action-menu-item system-action-menu-item--danger"
                     onClick={(e) => { e.stopPropagation(); removeSession(idx); setShowActions(false); }}
                   >
                      DELETE
                   </button>
                 )}
               </motion.div>
             </>
           )}
        </AnimatePresence>
      </div>
      </div>
    </motion.div>
  );
}

function DeepWorkBlock({ block, entry, update, visual }: any) {
  const tasks = useTaskStore(s => s.tasks);

  // Focus quality backwards support
  const legacyQualities = [
    (entry.dw1FocusQuality || 0) * 10,
    (entry.dw2FocusQuality || 0) * 10,
  ];

  const sessions: any[] =
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

  const saveSessions = (updated: typeof sessions) => {
    update({
      dynamic_values: {
        ...entry.dynamic_values,
        dwSessions: updated,
      },
    });
  };

  const updateSession = (idx: number, updates: any) => {
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
    if (session.isCompleted) return; // Never split completed sessions

    const currentDuration = session.duration || 60;
    const half = Math.floor(currentDuration / 2);

    const updatedCurrent = { ...session, duration: half };
    const clonedBlank = { 
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
  
  // ❗ Session duplication intentionally removed
  // Reason: breaks task-binding + execution integrity

  const unassigned = useMemo(() => {
    return tasks.filter(t => !t.completed && t.energyType === 'deep' && !sessions.some(s => s.taskId === t.id));
  }, [tasks, sessions]);

  const [creatingForIdx, setCreatingForIdx] = useState<number | null>(null);

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="EXECUTION TIMELINE" i={2} />
      <div className="daily-timeline-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.map((session, idx) => (
           <DeepWorkSessionRow 
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

        {/* Unscheduled Tasks Warning */}
        {unassigned.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
             <div className={typeStyles.label} style={{ color: '#fff', opacity: 0.8, marginBottom: '12px', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>UNSCHEDULED TASKS</div>
             {unassigned.map(ut => (
                 <div key={ut.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#bfbfbf', marginBottom: '6px' }}>
                     <span>- {ut.title} ({ut.priority})</span>
                     <button onClick={() => {
                        const emptyIdx = sessions.findIndex(s => !s.taskId && !s.taskTitle);
                        if (emptyIdx >= 0) updateSession(emptyIdx, { taskId: ut.id, taskTitle: ut.title, isLocked: false });
                        else {
                            const ns = [...sessions, { id: `dw-${Date.now()}`, taskId: ut.id, taskTitle: ut.title, focus: 0, status: 'pending', duration: 60, isLocked: false }];
                            saveSessions(ns);
                        }
                     }} className="daily-add-to-session-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#5A5A5A', fontSize: '9px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                        ADD TO SESSION
                     </button>
                 </div>
             ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {creatingForIdx !== null && (
          <CreateTaskWizard onClose={(taskId) => {
             if (taskId) {
                const title = useTaskStore.getState().tasks.find(t => t.id === taskId)?.title;
                updateSession(creatingForIdx, { taskId, taskTitle: title, isLocked: false });
             }
             setCreatingForIdx(null);
          }} />
        )}
      </AnimatePresence>
    </section>
  );
}

function ProductionBlock({ entry, update, visual }: any) {
  const outputScore = (entry.outputScore || entry.values?.outputScore || 0) * 10;
  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="PRODUCTION" i={3} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <TextAreaField
          label="OUTPUT"
          value={entry.productionOutput || entry.values?.productionOutput}
          onChange={(v: string) => update({ productionOutput: v })}
          placeholder="What did you produce?"
          typing
        />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 * 0.04, duration: 0.35 }} className="daily-energy-panel daily-score-panel">
          <div className="daily-energy-head">
            <span className={typeStyles.label}>SCORE</span>
            <SignalValue value={outputScore || '--'} className="metric-number-sm" pulse={Boolean(outputScore)} />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={outputScore}
            onChange={(e) => update({ outputScore: (parseInt(e.target.value, 10) || 0) / 10 })}
            className="daily-energy-slider daily-score-slider"
            aria-label="Production score"
          />
          <div className="daily-energy-ticks daily-score-ticks" aria-hidden="true">
            {Array.from({ length: 11 }, (_, idx) => (
              <span key={idx} className={`daily-energy-tick${outputScore >= idx * 10 ? ' is-active' : ''}`} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}



function ReflectionBlock({ entry, update, visual }: any) {
  const [step, setStep] = useState(-1);
  const refData = entry.dynamic_values?.reflection || {};

  const setRef = (key: string, val: string) => {
    update({ dynamic_values: { ...entry.dynamic_values, reflection: { ...refData, [key]: val } } });
  };

  const hasDeepWork = entry.structure_snapshot?.some((b: any) => b.type === 'deep_work') || false;
  const hasBody = entry.structure_snapshot?.some((b: any) => b.type === 'body') || false;
  const { score } = calculateScore(entry);

  const questions: Array<{ id: string, title: string, options?: string[], color?: string, isInput?: boolean }> = [];

  if (hasDeepWork) {
    questions.push({ id: 'deepWork', title: 'Did you complete your deep work sessions?', options: ['All', 'Partial', 'None'] });
  }

  questions.push({ id: 'tasks', title: 'Were your planned tasks completed?', options: ['Yes', 'Mostly', 'No'] });

  if (hasBody) {
    questions.push({ id: 'body', title: 'Was your body system completed?', options: ['Yes', 'No'] });
  }

  questions.push({ id: 'energy', title: 'How was your energy today?', options: ['Low', 'Stable', 'High'] });

  // Phase 5 — Truth Engine: Structured failure detection
  if (refData.deepWork === 'Partial' || refData.deepWork === 'None') {
    questions.push({ id: 'deepWorkFailure', title: 'What blocked your deep work?', options: ['DISTRACTION', 'LOW_ENERGY', 'OVERLOAD', 'NO_CLARITY'], color: '#fff' });
  }

  if (refData.energy === 'Low') {
    questions.push({ id: 'energyDropReason', title: 'Why was your energy low?', options: ['SLEEP', 'STRESS', 'DIET', 'UNKNOWN'], color: 'rgba(255,255,255,0.8)' });
  }

  // Legacy follow-up (kept for backward compat)
  if (refData.deepWork === 'None' && !refData.deepWorkFailure) {
    questions.push({ id: 'followUpReason', title: 'Why was deep work skipped?', options: ['Time issue', 'Low energy', 'Distraction'], color: '#fff' });
  } else if (score < 50 && (refData.deepWork || refData.tasks)) {
    questions.push({ id: 'followUpReason', title: 'What limited your performance?', options: ['Sleep', 'Focus', 'Planning'], color: 'rgba(255,255,255,0.8)' });
  } else if (score >= 80 && (refData.deepWork || refData.tasks)) {
    questions.push({ id: 'followUpReason', title: 'What worked well today?', options: ['Focus', 'Structure', 'Energy'], color: '#fff' });
  }

  questions.push({ id: 'note', title: 'Anything worth sharing?', isInput: true });

  const currentQ = questions[step] || questions[questions.length - 1]; // Safe fallback for exit animation

  // Auto-close when reaching the end
  useEffect(() => {
    if (step === questions.length) {
      const timer = setTimeout(() => {
        setStep(-2); // -2 = Done
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, questions.length]);

  // Scroll lock preventing frozen UI bugs
  useEffect(() => {
    if (step >= 0 && step < questions.length) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [step, questions.length]);

  return (
    <>
      <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
        <SectionTitle text="REFLECTION" i={4} />
        <div style={{ marginTop: '24px' }}>
          {step === -2 ? (
            <div className={typeStyles.body} style={{ color: '#8a8a8a' }}>Reflection captured.</div>
          ) : (
            <SystemButton
              variant="secondary"
              onClick={() => setStep(0)}
            >
              INITIATE
            </SystemButton>
          )}
        </div>
      </section>

      <AnimatePresence>
        {step >= 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '24px'
            }}
          >
            {/* Subtle glow layer behind the wizard */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.04), transparent 70%)'
            }} />

            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '640px', minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: 'translateY(-5%)' }}>

              {step < questions.length ? (
                <>
                  <div style={{ width: '100%', maxWidth: '560px', marginBottom: '64px' }}>
                    <div className="task-wizard-topbar">
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
                        onClick={() => setStep(-1)}
                        className="task-wizard-nav task-wizard-nav-close"
                      >
                        <span className="task-wizard-nav-text">Close</span>
                        <span className="task-wizard-nav-icon">&times;</span>
                      </button>
                    </div>
                    <div className="task-wizard-progress" style={{ justifyContent: 'center' }}>
                      {questions.map((_: any, i: number) => (
                        <div key={i} className={`task-wizard-progress-segment ${i <= step ? 'active' : 'inactive'}`} />
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQ.id}
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      className="wizard-question-gap"
                    >
                      <div className="task-wizard-question" style={{ color: currentQ.color || '#fff', marginBottom: '18px' }}>
                        {currentQ.title}
                      </div>
                      <div className="task-wizard-prompt" style={{ marginBottom: '24px' }}>
                        System interrogation active. Respond to move the day log forward.
                      </div>

                      {currentQ.isInput ? (
                        <div className="wizard-option-gap" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                          <div className="task-wizard-input-shell" style={{ maxWidth: '420px' }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder="Short insight..."
                              value={refData.note || ''}
                              onChange={(e) => setRef('note', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setStep(step + 1);
                              }}
                              className="task-wizard-input reflection-input"
                            />
                            <div className="task-wizard-input-line" />
                          </div>
                          <SystemButton variant="secondary" onClick={() => setStep(step + 1)}>
                            CAPTURE
                          </SystemButton>
                        </div>
                      ) : (
                        <div className="task-wizard-option-stack wizard-option-gap">
                          {currentQ.options?.map(opt => {
                            const isActive = refData[currentQ.id as keyof typeof refData] === opt;
                            const hasAnswer = !!refData[currentQ.id as keyof typeof refData];
                            return (
                              <motion.button
                                key={opt}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.08, duration: 0.22 }}
                                className={`task-wizard-option ${isActive ? 'selected' : hasAnswer ? 'task-wizard-option-muted' : ''}`}
                                onClick={() => {
                                  setRef(currentQ.id, opt);
                                  setTimeout(() => setStep(step + 1), 200); // match DayBuilder speed
                                }}
                              >
                                {opt}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                >
                  <div style={{ fontSize: '18px', fontWeight: 400, color: '#fff' }}>Captured.</div>
                  <div className="wizard-label" style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: '0.1em' }}>Analyzing your day...</div>
                </motion.div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

void ReflectionBlock;

function StableReflectionBlock({ entry, update, visual }: any) {
  const [status, setStatus] = useState<'idle' | 'active' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const refData = entry.dynamic_values?.reflection || {};
  const reflectionStarted = Object.keys(refData).length > 0;

  const setRef = (key: string, val: string) => {
    update({ dynamic_values: { ...entry.dynamic_values, reflection: { ...refData, [key]: val } } });
  };

  const hasDeepWork = entry.structure_snapshot?.some((b: any) => b.type === 'deep_work') || false;
  const hasBody = entry.structure_snapshot?.some((b: any) => b.type === 'body') || false;
  const { score } = calculateScore(entry);

  const questions = useMemo(() => {
    const items: Array<{ id: string, title: string, options?: string[], color?: string, isInput?: boolean }> = [];

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
  const reflectionComplete = questions.every((question) => question.isInput ? true : Boolean(refData[question.id]));

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
    if (status === 'active') document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';

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
                        const isActive = refData[currentQ.id as keyof typeof refData] === opt;
                        const hasAnswer = !!refData[currentQ.id as keyof typeof refData];
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

function CustomBlock({ block, entry, update, visual }: any) {
  const customValues = entry.dynamic_values?.custom || {};
  const value = customValues[block.id];
  const numericValue = typeof value === 'number' ? value : parseInt(String(value || 0), 10) || 0;

  const updateValue = (val: any) => {
    update({ dynamic_values: { ...entry.dynamic_values, custom: { ...customValues, [block.id]: val } } });
  };

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text={block.title.toUpperCase()} i={5} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {block.customType === 'toggle' && (
          <DotToggleRow label="STATUS" active={!!value} onToggle={() => updateValue(!value)} i={0} />
        )}
        {block.customType === 'number' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.35 }} className="daily-energy-panel daily-score-panel">
            <div className="daily-energy-head">
              <span className={typeStyles.label}>VALUE</span>
              <SignalValue value={numericValue || '--'} className="metric-number-sm" pulse={Boolean(numericValue)} />
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={Math.min(10, Math.max(0, numericValue))}
              onChange={(e) => updateValue(Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0)))}
              className="daily-energy-slider daily-custom-number-slider"
              aria-label={`${block.title} value`}
            />
            <div className="daily-energy-ticks" aria-hidden="true">
              {Array.from({ length: 10 }, (_, idx) => (
                <span key={idx} className={`daily-energy-tick${Math.min(10, Math.max(0, numericValue)) > idx ? ' is-active' : ''}`} />
              ))}
            </div>
          </motion.div>
        )}
        {block.customType === 'text' && (
          <TextAreaField label="NOTES" value={value || ''} onChange={(v: string) => updateValue(v)} />
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   DAILY — LIFECYCLE PAGE
   ═══════════════════════════════════════ */

import SystemControlPanel from '../components/SystemControlPanel';
import DayBuilder from '../components/DayBuilder';
import AutoDayOverlay from '../components/AutoDayOverlay';

export default function Daily() {
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState(urlDate || format(new Date(), 'yyyy-MM-dd'));

  // Sync when URL param changes (e.g. from Timeline click)
  useEffect(() => {
    if (urlDate && urlDate !== selectedDate) setSelectedDate(urlDate);
  }, [urlDate]);
  const entries = useDailyStore((s) => s.entries);
  const updateEntry = useDailyStore((s) => s.updateEntry);
  const completeEntry = useDailyStore((s) => s.completeEntry);
  const getActiveTemplateStructure = useDailyStore((s) => s.getActiveTemplateStructure);
  const getActiveTemplateName = useDailyStore((s) => s.getActiveTemplateName);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isAutoDayOpen, setIsAutoDayOpen] = useState(false);
  const builderData = useAutoDayStore(s => s.builderData);
  const resetAutoDay = useAutoDayStore(s => s.reset);

  const dayTemplate = getActiveTemplateStructure() || [];
  const entry = useMemo(() => entries[selectedDate] || createEmptyEntry(selectedDate, dayTemplate), [entries, selectedDate, dayTemplate]);
  const activeTemplate = entry.structure_snapshot && entry.structure_snapshot.length > 0 ? entry.structure_snapshot : dayTemplate;
  const resolvedModeName = useMemo(() => {
    const entryMode = entry.dynamic_values?.modeName;
    if (entryMode) return normalizeModeName(entryMode);
    const activeTemplateName = getActiveTemplateName();
    if (activeTemplateName && activeTemplateName !== 'UNKNOWN SYSTEM') return normalizeModeName(activeTemplateName, { defaultName: 'EXECUTION MODE' });
    return 'BUILD MODE';
  }, [entry.dynamic_values?.modeName, getActiveTemplateName]);

  useEffect(() => {
    if (!entries[selectedDate]) updateEntry(selectedDate, { structure_snapshot: dayTemplate });
  }, [selectedDate, entries, updateEntry, dayTemplate]);

  const mode = entry.dynamic_values?.modeName;
  // Fallback Safety: If mode is missing or entry isn't built, auto-day is primary
  const isBlank = !entry.isBuilt || !mode;

  useEffect(() => {
    if (isBlank && !isBuilderOpen) setIsAutoDayOpen(true);
    else if (!isBlank) setIsAutoDayOpen(false);
  }, [selectedDate, isBlank]);

  // Global unmount cleanup — prevent ghost state if user navigates away
  useEffect(() => {
    return () => {
      useAutoDayStore.getState().reset();
    };
  }, []);

  // Handle EDIT handoff from AutoDay
  useEffect(() => {
    if (builderData) {
      setIsAutoDayOpen(false);
      setIsBuilderOpen(true);
    }
  }, [builderData]);

  const handleOpenBuilder = () => {
    setIsAutoDayOpen(false);
    setIsBuilderOpen(true);
  };

  const handleOpenAutoDay = () => {
    setIsBuilderOpen(false);
    resetAutoDay(); 
    setIsAutoDayOpen(true);
  };

  const shiftDay = useCallback((direction: -1 | 1) => {
    const current = new Date(selectedDate);
    const next = direction === -1 ? subDays(current, 1) : addDays(current, 1);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  }, [selectedDate]);

  /* ─── Auto-Save ─── */
  const [saveStatus, setSaveStatus] = useState('');
  const save = useCallback((updates: Partial<DailyEntry>) => {
    updateEntry(selectedDate, updates);
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(''), 1500);
  }, [selectedDate, updateEntry]);

  const debouncedSave = useDebounce((updates: unknown) => save(updates as Partial<DailyEntry>), 500);

  const update = useCallback((updates: Partial<DailyEntry>) => {
    updateEntry(selectedDate, updates);
    debouncedSave(updates);
  }, [selectedDate, updateEntry, debouncedSave]);

  const liveScore = useMemo(() => {
    try { return calculateScore(entry); } catch { return { score: 0, state: 'STABLE' as const }; }
  }, [entry]);

  const allCompleted = useMemo(() => (Object.values(entries) as DailyEntry[]).filter(e => e.completed).sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const pattern = useMemo(() => detectPattern(allCompleted), [allCompleted]);

  const hasMinData = (entry.totalSleepHours || 0) > 0 && (entry.energyLevel || 0) > 0;
  useEffect(() => {
    if (hasMinData && !entry.completed) {
      const timer = setTimeout(() => completeEntry(selectedDate), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasMinData, entry.completed, selectedDate, completeEntry]);

  const removeSection = (index: number) => {
    const newStructure = activeTemplate.filter((_, i) => i !== index);
    update({ structure_snapshot: newStructure });
  };

  const duplicateSection = (index: number) => {
    const newStructure = [...activeTemplate];
    newStructure.splice(index + 1, 0, { ...activeTemplate[index], id: uuidv4() });
    update({ structure_snapshot: newStructure });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newStructure = [...activeTemplate];
    const [removed] = newStructure.splice(index, 1);
    if (direction === 'up' && index > 0) {
      newStructure.splice(index - 1, 0, removed);
    } else if (direction === 'down' && index < newStructure.length) {
      newStructure.splice(index + 1, 0, removed);
    }
    update({ structure_snapshot: newStructure });
  };

  /* ─── Render ─── */
  const visual = useMemo(() => ({ border: 0.08 }), []);

  return (
    <div className="dashboard relative min-h-screen" style={{ paddingBottom: '200px', position: 'relative' }}>
      
      {/* ── REALISM LAYER: Cursor Light ── */}
      <div className="daily-system-background" aria-hidden="true">

      {/* ── REALISM LAYER: Depth Background ── */}
        <div className="ifz14-flow-field" />
      </div>

      <SystemControlPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} selectedDate={selectedDate} onDateChange={setSelectedDate} onOpenGenerator={() => setIsBuilderOpen(true)} />

      {/* ── SYSTEM PRESENCE HEADER (MEDIUM DEPTH) ── */}
      <div style={{ marginBottom: '64px', position: 'relative', zIndex: 'var(--z-base)' }}>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...motionTiming.medium, delay: dashboardSequence.heading }} className="daily-hero mb-10">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionTiming.medium, delay: dashboardSequence.heading }}
            className="daily-date-row"
          >
            <button type="button" className="daily-date-arrow" onClick={() => shiftDay(-1)} aria-label="Previous day">
              ←
            </button>
            <div className="daily-date-label-group">
              <p className={typeStyles.label} style={{ marginBottom: 0 }}>
                {format(new Date(selectedDate), 'MMMM dd, yyyy').toUpperCase()}
              </p>
              {isToday(new Date(selectedDate)) ? <span className="daily-date-today">TODAY</span> : null}
            </div>
            <button type="button" className="daily-date-arrow" onClick={() => shiftDay(1)} aria-label="Next day">
              →
            </button>
          </motion.div>
          <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
            <input type="date" value={selectedDate} onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value) }} />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8, letterSpacing: '0.14em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.09em' }}
            transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.08 }}
            className="heading-mode text-white"
            style={{ margin: 0 }}
          >
            {formatHeadingText(resolvedModeName)}
          </motion.h1>

          <div className="daily-hero-command-row">
             <span className="daily-hero-state">STATE: ACTIVE</span>
             <span className="daily-hero-separator">•</span>
             <SystemButton variant="ghost" onClick={handleOpenBuilder}>CHANGE</SystemButton>
             <span style={{ opacity: 0.3 }}>•</span>
             <span className="daily-hero-separator">•</span>
             <SystemButton variant="ghost" onClick={handleOpenAutoDay}>AUTO-DAY</SystemButton>
          </div>
          <div className="daily-hero-subtext">
            {formatHeadingText(resolvedModeName)} loaded. Wake, body, execution, production, reflection.
          </div>
        </motion.div>
      </div>

      {/* Auto-Day Overlay — Primary day creation */}
      <AnimatePresence>
        {isAutoDayOpen && (
          <AutoDayOverlay
            onCancel={() => setIsAutoDayOpen(false)}
            onComplete={(template, modeName, preFilled) => {
              update({
                isBuilt: true,
                structure_snapshot: template,
                dynamic_values: { ...(entry.dynamic_values || {}), modeName, ...preFilled }
              });
              setIsAutoDayOpen(false);
              setIsBuilderOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* DayBuilder — Manual override / Edit mode */}
      {isBuilderOpen ? (
        <DayBuilder
          onCancel={() => {
            useAutoDayStore.getState().reset();
            setIsBuilderOpen(false);
            if (isBlank) setIsAutoDayOpen(true);
          }}
          onComplete={(template, modeName, preFilled) => {
            update({
              isBuilt: true,
              structure_snapshot: template,
              dynamic_values: { ...(entry.dynamic_values || {}), modeName, ...preFilled }
            });
            setIsBuilderOpen(false);
          }}
        />
      ) : (
        <>
          {/* ── DYNAMIC STREAM (FAST DEPTH) ── */}
          <motion.div
            key={selectedDate}
            className="daily-flow-stack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 'var(--z-base)' }}
          >
            <AnimatePresence>
              {activeTemplate.map((block: DayBlock, index: number) => {
                const props = {
                  block,
                  entry,
                  update,
                  visual, // Passing down visual mapping
                  title: block.title,
                  canRemove: activeTemplate.length > 1,
                  onRemove: () => removeSection(index),
                  onDuplicate: () => duplicateSection(index),
                  onMoveUp: () => moveSection(index, 'up'),
                  onMoveDown: () => moveSection(index, 'down'),
                };

                return (
                  <motion.div
                    key={block.id}
                    layout
                    initial={{ opacity: 0, scale: 0.985 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.22 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ ...motionTiming.medium, delay: index * 0.06 }}
                    style={{ position: 'relative' }}
                    className={`daily-flow-row ${index === activeTemplate.length - 1 ? 'is-last' : ''}`}
                  >
                    <div className="daily-flow-rail" aria-hidden="true">
                      <div className="daily-flow-node">{String(index + 1).padStart(2, '0')}</div>
                      {index !== activeTemplate.length - 1 ? <div className="daily-flow-line" /> : null}
                    </div>
                    <div className="daily-flow-content">
                      {block.type === 'wake' && <WakeBlock {...props} />}
                      {block.type === 'body' && <BodyBlock {...props} />}
                      {block.type === 'deep_work' && <DeepWorkBlock {...props} />}
                      {block.type === 'production' && <ProductionBlock {...props} />}
                      {block.type === 'reflection' && <StableReflectionBlock {...props} />}
                      {block.type === 'custom' && <CustomBlock {...props} />}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* ── LIVE SYSTEM OUTPUT ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...motionTiming.slow, delay: dashboardSequence.footer }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'linear-gradient(transparent, rgba(0,0,0,0.95) 30%, #000)', padding: '40px 0 24px', pointerEvents: 'none' }}
          >
            <div className="daily-system-footer" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div className="daily-system-footer-readout" style={{ display: 'flex', gap: '18px', alignItems: 'baseline' }}>
                <span className={typeStyles.label}>System Load</span>
                <AnimatedMetric value={liveScore.score} className="system-output-pulse metric-number-sm text-white" />
                <motion.span key={liveScore.state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="daily-system-footer-state" data-statelabel={`STATE: ${liveScore.state} ${pattern.trend === 'RISING' ? '↑' : pattern.trend === 'DECLINING' ? '↓' : '→'}`} style={{ fontSize: '13px', letterSpacing: '0.12em', color: '#888' }}>
                  {liveScore.state} {pattern.trend === 'RISING' ? '↑' : pattern.trend === 'DECLINING' ? '↓' : '→'}
                </motion.span>
              </div>
              <AnimatePresence>
                {saveStatus && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: '11px', color: '#5A5A5A', letterSpacing: '0.1em' }}>{saveStatus}</motion.span>}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
