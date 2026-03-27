import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGoalStore } from '../../../stores/goalStore';
import { useTaskStore } from '../../../stores/taskStore';
import { type as typeStyles } from '../../../typography';
import { SignalValue } from './DailyPrimitives';
import type { DeepWorkSessionRowProps } from './DeepWorkBlock';

export function DeepWorkSessionRow({
  session,
  idx,
  tasks,
  unassigned,
  updateSession,
  removeSession,
  splitSession,
  canRemove,
  onStartCreate,
  isLast,
}: DeepWorkSessionRowProps) {
  const addCompletedTime = useTaskStore((s) => s.addCompletedTime);
  const goals = useGoalStore((s) => s.goals);
  const [isOpen, setIsOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const focus = parseInt(String(session.focus)) || parseInt(String(session.quality)) || 0;
  const prevFocus = useRef(focus);

  useEffect(() => {
    if (prevFocus.current <= 40 && focus > 40 && session.taskId && !session.isCompleted) {
      updateSession(idx, { isCompleted: true, status: 'done' });
      addCompletedTime(session.taskId, session.duration || 60);
    }
    prevFocus.current = focus;
  }, [focus, session.taskId, idx, updateSession, session.isCompleted, session.duration, addCompletedTime]);

  const linked = session.taskId ? tasks.find((task) => task.id === session.taskId) : null;
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

  const displayStatus = (() => {
    if (session.isCompleted || session.status === 'done') return 'completed';
    if (focus > 0 || session.status === 'active') return 'active';
    if (session.startTime) {
      const now = new Date();
      const [h, m] = String(session.startTime).split(':').map(Number);
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

  const endTime = (() => {
    if (!session.startTime) return null;
    const [h, m] = String(session.startTime).split(':').map(Number);
    const totalMin = h * 60 + m + (session.duration || 60);
    return `${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`;
  })();

  return (
    <motion.div
      className={`session-row daily-session-row is-${displayStatus}${isLast ? ' is-last' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      whileHover={{ y: -2 }}
      transition={{ delay: idx * 0.04, duration: 0.3 }}
      layout
      style={{ background: badge.bg, marginBottom: '8px', ['--session-accent' as never]: badge.color, ['--session-border' as never]: badge.border }}
    >
      <div className="daily-session-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingTop: '4px' }}>
        <span className="font-mono text-[11px] uppercase daily-session-time-value" style={{ fontWeight: 600, color: badge.color }}>
          {session.startTime ? `${session.startTime}${endTime ? ` TO ${endTime}` : ''}` : `SESSION ${idx + 1}`}
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
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
                  <motion.div
                    className="dw-menu"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        CREATE TASK
                      </div>
                    )}

                    {unassigned.length > 0 && <div className={typeStyles.label} style={{ color: '#555', padding: '8px 12px 4px 12px' }}>SMART SUGGESTIONS</div>}
                    {unassigned.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => { updateSession(idx, { taskId: task.id, taskTitle: task.title, isLocked: false }); setIsOpen(false); }}
                        style={{
                          padding: '8px 12px', fontSize: '13px', color: '#fff', cursor: 'pointer', borderRadius: '6px',
                          display: 'flex', justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="font-primary text-[13px]" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </span>
                        <span className="font-mono text-[11px]" style={{ color: '#555', marginLeft: '8px', letterSpacing: '0.08em' }}>
                          {String(task.priority || '').toUpperCase()} TIME {task.estimatedTime}M
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
                TIME
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
                const linkedGoal = linked?.goalId ? goals.find((goal) => goal.id === linked.goalId) : null;
                if (!linkedGoal) return null;

                let impact = 0;
                if (linkedGoal.targetType === 'task_count') impact = (1 / linkedGoal.targetValue) * 100;
                else if (linkedGoal.targetType === 'time') impact = ((session.duration || 60) / linkedGoal.targetValue) * 100;
                const impactStr = impact > 0 ? ` (+${impact >= 1 ? Math.round(impact) : impact.toFixed(1)}%)` : '';

                return (
                  <span className="goal-impact-badge daily-session-goal-link font-primary text-[10px]" style={{ color: '#4ade80', letterSpacing: '0.04em', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', padding: '3px 8px', borderRadius: '4px', marginLeft: 'auto' }}>
                    GOAL {linkedGoal.title}{impactStr}
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
            MENU
          </button>

          <AnimatePresence>
            {showActions && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowActions(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="system-action-menu"
                  style={{ position: 'absolute', right: '100%', top: '0', marginRight: '8px', zIndex: 100, width: '140px' }}
                >
                  {hasTask && (
                    <button className="system-action-menu-item" onClick={(e) => { e.stopPropagation(); clearTask(); setShowActions(false); }}>
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
