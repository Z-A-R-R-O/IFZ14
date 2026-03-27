import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAutoDayStore } from '../stores/autoDayStore';
import { format, isToday } from 'date-fns';
import type { DayBlock } from '../types';
import AnimatedMetric from '../components/AnimatedMetric';
import SystemButton from '../components/SystemButton';
import { BodyBlock as DailyBodyBlock } from '../features/daily/components/BodyBlock';
import { CustomBlock as DailyCustomBlock } from '../features/daily/components/CustomBlock';
import { DeepWorkBlock as DailyDeepWorkBlock } from '../features/daily/components/DeepWorkBlock';
import { DeepWorkSessionRow as DailyDeepWorkSessionRow } from '../features/daily/components/DeepWorkSessionRow';
import { ProductionBlock as DailyProductionBlock } from '../features/daily/components/ProductionBlock';
import { StableReflectionBlock as DailyStableReflectionBlock } from '../features/daily/components/StableReflectionBlock';
import { WakeBlock as DailyWakeBlock } from '../features/daily/components/WakeBlock';
import { useDailyPageModel } from '../features/daily/hooks/useDailyPageModel';
import { formatHeadingText, type as typeStyles } from '../typography';
import { dashboardSequence, motionTiming } from '../motion';

/* ═══════════════════════════════════════
   DAILY — LIFECYCLE PAGE
   ═══════════════════════════════════════ */

import SystemControlPanel from '../components/SystemControlPanel';
import DayBuilder from '../components/DayBuilder';
import AutoDayOverlay from '../components/AutoDayOverlay';

export default function Daily() {
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date');
  const {
    activeTemplate,
    duplicateSection,
    entries,
    entry,
    handleOpenAutoDay,
    handleOpenBuilder,
    isAutoDayOpen,
    isBlank,
    isBuilderOpen,
    isPanelOpen,
    liveScore,
    moveSection,
    pattern,
    removeSection,
    resolvedModeName,
    saveStatus,
    selectedDate,
    setIsAutoDayOpen,
    setIsBuilderOpen,
    setIsPanelOpen,
    setSelectedDate,
    shiftDay,
    tasks,
    update,
    visual,
  } = useDailyPageModel({ urlDate });

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
          {isBlank ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTiming.medium, delay: dashboardSequence.footer * 0.5 }}
              style={{ minHeight: '48vh', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 'var(--z-base)' }}
            >
              <div
                className="analytics-card daily-system-panel"
                style={{
                  width: '100%',
                  maxWidth: '560px',
                  padding: '32px 28px',
                  border: `1px solid rgba(255,255,255,${visual.border})`,
                  display: 'grid',
                  gap: '18px',
                  textAlign: 'center',
                }}
              >
                <div className={typeStyles.label}>DAY NOT LOADED</div>
                <h2 className="heading-mode text-white" style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 36px)' }}>
                  Select Day Template
                </h2>
                <p className={typeStyles.body} style={{ margin: 0, color: 'rgba(255,255,255,0.62)' }}>
                  This date does not have an active day structure yet. Choose a template manually or generate one with Auto-Day.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <SystemButton variant="primary" onClick={handleOpenBuilder}>SELECT TEMPLATE</SystemButton>
                  <SystemButton variant="ghost" onClick={handleOpenAutoDay}>AUTO-DAY</SystemButton>
                </div>
              </div>
            </motion.div>
          ) : null}

          {!isBlank ? <motion.div
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
                      {block.type === 'wake' && <DailyWakeBlock entry={entry} entries={entries} update={update} visual={visual} />}
                      {block.type === 'body' && <DailyBodyBlock entry={entry} update={update} visual={visual} />}
                      {block.type === 'deep_work' && (
                        <DailyDeepWorkBlock
                          {...props}
                          tasks={tasks}
                          lookupTaskTitle={(taskId: string) => tasks.find((task: any) => task.id === taskId)?.title}
                          SessionRow={DailyDeepWorkSessionRow}
                        />
                      )}
                      {block.type === 'production' && <DailyProductionBlock {...props} />}
                      {block.type === 'reflection' && <DailyStableReflectionBlock {...props} />}
                      {block.type === 'custom' && <DailyCustomBlock {...props} />}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div> : null}

          {/* ── LIVE SYSTEM OUTPUT ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...motionTiming.slow, delay: dashboardSequence.footer }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'linear-gradient(transparent, rgba(0,0,0,0.95) 30%, #000)', padding: '40px 0 24px', pointerEvents: 'none' }}
          >
            <div className="daily-system-footer" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div className="daily-system-footer-readout" style={{ display: 'flex', gap: '18px', alignItems: 'baseline' }}>
                <span className={typeStyles.label}>System Load</span>
                <AnimatedMetric value={liveScore.score} className="system-output-pulse metric-number-sm text-white" />
<motion.span key={liveScore.state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="daily-system-footer-state" data-statelabel={`STATE: ${liveScore.state} ${pattern.trend === 'RISING' ? 'UP' : pattern.trend === 'DECLINING' ? 'DOWN' : 'FLAT'}`} style={{ fontSize: '13px', letterSpacing: '0.12em', color: '#888' }}>
                  {liveScore.state} {pattern.trend === 'RISING' ? 'UP' : pattern.trend === 'DECLINING' ? 'DOWN' : 'FLAT'}
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





