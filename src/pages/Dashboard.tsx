import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDailyStore } from '../stores/dailyStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { useBiometricStore } from '../stores/biometricStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { calculateScore, calculateScoreBreakdown } from '../engines/scoreEngine';
import { detectPattern } from '../engines/patternEngine';
import { calculateStreaks } from '../engines/streakEngine';
import { assessRisk } from '../engines/riskEngine';
import { generateSuggestions } from '../engines/suggestionEngine';
import { detectCausation, analyzeFailures, predictOutcome, generateActions } from '../engines/analyticsEngine';
import { computeAllGoals } from '../engines/goalEngine';
import type { DailyEntry } from '../types';
import {
  getBodySignal,
  getConditionSignal,
  getDeepWorkSignal,
  getExecutionSignal,
  getIntegritySignal,
  getProductionSignal,
  hasBodyRoutineConfigured,
  hasCompletedBodyRoutine,
} from '../engines/systemSignals';
import { useSystemIntensity } from '../system/visual/useSystemIntensity';
import { formatHeadingText, type as typeStyles } from '../typography';
import AnimatedMetric from '../components/AnimatedMetric';
import { dashboardSequence } from '../motion';
import SystemSurface, { type SurfaceVariant } from '../ui/components/SystemSurface';
import { format, parseISO, subDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { normalizeModeName } from '../lib/modeName';

const motionConfig = {
  smooth: { duration: 0.32, ease: [0.24, 0.9, 0.2, 1] as const },
  slow: { duration: 0.6, ease: [0.24, 0.9, 0.2, 1] as const },
};

function GlassSurface({ children, variant = 'base', className = '', delay = 0, style = {} }: { children: React.ReactNode; i?: number; variant?: SurfaceVariant; className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <SystemSurface variant={variant} className={`dashboard-panel ${className}`.trim()} delay={delay} style={style}>
      {children}
    </SystemSurface>
  );
}

function HeroRadialScore({ score, execution, intensity }: { score: number; execution: number; intensity: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const pulseSpeed = Math.max(1.6, 3.2 - (execution / 100) * 1.2);
  const tickCount = 20;

  return (
    <motion.div
      className="parallax-layer-3"
      style={{ position: 'relative', width: '184px', height: '184px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
    >
      <svg width="184" height="184" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="92" cy="92" r={radius} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="3" />
        {Array.from({ length: tickCount }).map((_, index) => {
          const angle = (index / tickCount) * Math.PI * 2;
          const inner = radius + 9;
          const outer = radius + (index % 5 === 0 ? 15 : 12);
          const x1 = 92 + Math.cos(angle) * inner;
          const y1 = 92 + Math.sin(angle) * inner;
          const x2 = 92 + Math.cos(angle) * outer;
          const y2 = 92 + Math.sin(angle) * outer;
          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={`rgba(255,255,255,${0.08 + intensity * 0.06})`}
              strokeWidth={index % 5 === 0 ? 1.1 : 0.8}
            />
          );
        })}
        <motion.circle
          cx="92"
          cy="92"
          r={radius}
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ delay: 0.16, duration: 0.7, ease: [0.2, 0.88, 0.2, 1] }}
          strokeLinecap="round"
          style={{ strokeDasharray: `${circumference * 0.22} ${circumference * 0.04}` }}
        />
      </svg>
      <motion.div
        animate={{ opacity: [0.97, 1, 0.97] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          color: '#fff', zIndex: 2,
          textShadow: 'none',
          width: '112px', height: '112px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
        }}
      >
        <motion.div initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.9, 0.2, 1] }}>
          <AnimatedMetric value={score} className="score-number" style={{ textShadow: 'none' }} />
        </motion.div>
      </motion.div>
      <div style={{ position: 'absolute', bottom: '-24px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.16, 0.4, 0.16] }}
            transition={{ duration: pulseSpeed + 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            style={{ width: '10px', height: '2px', background: execution > (i * 20) ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.16)', borderRadius: '1px' }}
          />
        ))}
      </div>
    </motion.div>
  );
}




function CommandPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'critical' | 'positive' }) {
  return (
    <div className={`dashboard-command-pill is-${tone}`}>
      <span className="dashboard-command-pill-label">{label}</span>
      <span className="dashboard-command-pill-value">{value}</span>
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  suffix = '',
  note,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  note: string;
}) {
  return (
    <div className="dashboard-summary-card">
      <div className="dashboard-summary-label">{label}</div>
      <div className="dashboard-summary-value-row">
        {typeof value === 'number' ? (
          <AnimatedMetric value={value} className="dashboard-summary-value" />
        ) : (
          <span className="dashboard-summary-value">{value}</span>
        )}
        {suffix ? <span className="dashboard-summary-suffix">{suffix}</span> : null}
      </div>
      <div className="dashboard-summary-note">{note}</div>
    </div>
  );
}

function BreakdownRail({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="dashboard-breakdown-row">
      <div className="dashboard-breakdown-head">
        <span className="dashboard-breakdown-label">{label}</span>
        <span className="dashboard-breakdown-value">{Math.round(value)}%</span>
      </div>
      <div className="dashboard-breakdown-track">
        <motion.div
          className="dashboard-breakdown-fill"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.5, ease: [0.24, 0.9, 0.2, 1] }}
        />
      </div>
      <div className="dashboard-breakdown-note">{note}</div>
    </div>
  );
}

function FeedLine({ tag, text, tone = 'default' }: { tag: string; text: string; tone?: 'default' | 'critical' | 'positive' }) {
  return (
    <div className={`dashboard-feed-line is-${tone}`}>
      <span className="dashboard-feed-tag">{tag}</span>
      <span className="dashboard-feed-text">{text}</span>
    </div>
  );
}



/* ═══════════════════════════════════════
   DASHBOARD — Fully Dynamic
   ═══════════════════════════════════════ */

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const entries = useDailyStore((s) => s.entries);
  const goals = useGoalStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);
  const bodyHabits = useBiometricStore((s) => s.habits);
  const getAdjustedConfidence = useAnalyticsStore((s) => s.getAdjustedConfidence);

  const getActiveTemplateStructure = useDailyStore(s => s.getActiveTemplateStructure);
  const getActiveTemplateName = useDailyStore(s => s.getActiveTemplateName);
  const saveCustomTemplate = useDailyStore(s => s.saveCustomTemplate);
  const setActiveTemplate = useDailyStore(s => s.setActiveTemplate);

  /* ─── Derived Data (all from Zustand store, memoized for performance) ─── */

  const allCompleted = useMemo(() =>
    (Object.values(entries) as DailyEntry[])
      .filter(e => e.completed)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const todayEntry = entries[today];
  const currentModeName = useMemo(() => {
    const entryMode = todayEntry?.dynamic_values?.modeName;
    if (entryMode) return normalizeModeName(entryMode);
    const activeTemplateName = getActiveTemplateName();
    if (activeTemplateName && activeTemplateName !== 'UNKNOWN SYSTEM') return normalizeModeName(activeTemplateName, { defaultName: 'DOMINATION MODE' });
    return 'DOMINATION MODE';
  }, [todayEntry?.dynamic_values?.modeName, getActiveTemplateName]);

  // Last 7 days of data
  const last7Days = useMemo(() => {
    const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    return allCompleted.filter((e: any) => e.date >= cutoff);
  }, [allCompleted]);


  /* ─── Engine Calculations (all from real data) ─── */

  const scoreOptions = useMemo(() => ({ tasks, bodyHabits }), [tasks, bodyHabits]);
  const todayScore = useMemo(() =>
    todayEntry ? calculateScore(todayEntry, scoreOptions) : null,
    [todayEntry, scoreOptions]
  );
  const todayBreakdown = useMemo(() =>
    todayEntry ? calculateScoreBreakdown(todayEntry, scoreOptions) : null,
    [todayEntry, scoreOptions]
  );

  const pattern = useMemo(() => detectPattern(allCompleted), [allCompleted]);
  const streaks = useMemo(() => calculateStreaks(allCompleted), [allCompleted]);
  const risk = useMemo(() => assessRisk(allCompleted), [allCompleted]);
  const suggestions = useMemo(() => generateSuggestions(allCompleted, streaks), [allCompleted, streaks]);
  const insights = useMemo(
    () => detectCausation(allCompleted, { confidenceAdjuster: getAdjustedConfidence }),
    [allCompleted, getAdjustedConfidence]
  );
  const failures = useMemo(() => analyzeFailures(allCompleted), [allCompleted]);
  const prediction = useMemo(() => predictOutcome(todayEntry || {}, tasks), [todayEntry, tasks]);
  const actions = useMemo(() => generateActions(insights, failures), [insights, failures]);

  const handleApplySuggestion = (sig: any) => {
    if (sig.actionType === 'switch_template' && sig.actionPayload?.systemType) {
      const requestedSystem = sig.actionPayload.systemType;
      const templateTargetId = requestedSystem === 'balanced' ? 'execution' : requestedSystem;
      if (templateTargetId === 'domination' || templateTargetId === 'execution' || templateTargetId === 'recovery') {
        setActiveTemplate(templateTargetId);
      }
    } else if (sig.actionType === 'add_block') {
      const currentStructure = getActiveTemplateStructure() || [];
      const currentName = getActiveTemplateName() || 'CUSTOM SYSTEM';

      const newBlock = {
        id: `block-${uuidv4()}`,
        type: sig.actionPayload.blockType || 'custom',
        title: sig.actionPayload.customName || sig.actionPayload.blockType.toUpperCase(),
        weight: 1.0,
        customType: sig.actionPayload.customType,
        dwCount: 2
      };

      const updatedStructure = [...currentStructure, newBlock];
      const targetId = `custom_${Date.now()}`;

      saveCustomTemplate({
        id: targetId,
        type: 'custom',
        name: `${currentName} (Optimized)`,
        structure: updatedStructure,
        systemType: 'custom',
        version: Date.now(),
        createdAt: Date.now(),
      });
      setActiveTemplate(targetId);
    }
  };

  /* ─── Weekly Averages (from real data) ─── */

  const weeklyAvg = useMemo(() => {
    if (last7Days.length === 0) return null;
    const n = last7Days.length;
    return {
      score: Math.round(last7Days.reduce((sum, entry) => sum + calculateScore(entry).score, 0) / n),
      execution: Math.round(last7Days.reduce((sum, entry) => sum + getExecutionSignal(entry), 0) / n),
      condition: Math.round(last7Days.reduce((sum, entry) => sum + getConditionSignal(entry), 0) / n),
      integrity: Math.round(last7Days.reduce((sum, entry) => sum + getIntegritySignal(entry), 0) / n),
      focus: Math.round(last7Days.reduce((sum, entry) => sum + getDeepWorkSignal(entry), 0) / n),
      body: Math.round(last7Days.reduce((sum, entry) => sum + getBodySignal(entry), 0) / n),
      gymDays: last7Days.filter((entry) => hasCompletedBodyRoutine(entry)).length,
      bodyDays: last7Days.filter((entry) => hasCompletedBodyRoutine(entry)).length,
      production: Math.round(last7Days.reduce((sum, entry) => sum + getProductionSignal(entry), 0) / n),
    };
  }, [last7Days]);

  /* ─── Chart Data (last 7 days for DW, last 30 for score) ─── */



  /* ─── Display Values (today + fallback to weekly avg) ─── */

  const displayScore = todayScore?.score ?? weeklyAvg?.score ?? 0;
  const displayState = todayScore?.state ?? (weeklyAvg ? 'STABLE' : '—');

  const deepWorkDisplay = todayEntry
    ? String(getDeepWorkSignal(todayEntry))
    : weeklyAvg ? `${weeklyAvg.focus}` : '—';

  const bodyDisplay = todayEntry && hasBodyRoutineConfigured(todayEntry)
    ? '✓'
    : todayEntry?.gymTraining === 'partial'
      ? '◐'
      : weeklyAvg ? `${weeklyAvg.gymDays}/7` : '—';

  // Best active streak

  const resolvedBodyDisplay = todayEntry && hasBodyRoutineConfigured(todayEntry)
    ? `${getBodySignal(todayEntry)}%`
    : weeklyAvg ? `${weeklyAvg.bodyDays}/7` : bodyDisplay;

  const activeGoalSignals = useMemo(() => {
    const goalStats = computeAllGoals(goals, tasks, allCompleted as DailyEntry[]);
    return goals
      .map(goal => ({ goal, computed: goalStats[goal.id] }))
      .filter((item) => item.computed && item.computed.progress < 100)
      .sort((left, right) => right.computed.pressure - left.computed.pressure)
      .slice(0, 2);
  }, [allCompleted, goals, tasks]);

  const systemEvolutionLogs = useDailyStore(s => s.systemEvolutionLogs);
  const intensity = todayScore ? Math.max(0.1, todayScore.score / 100) : 0.05;
  const executionValue = todayBreakdown?.execution ?? weeklyAvg?.execution ?? 0;
  const liveTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);
  const pendingDeepCount = liveTasks.filter(task => task.energyType === 'deep').length;
  const pendingLightCount = liveTasks.filter(task => task.energyType !== 'deep').length;
  const executionRate = Math.round(executionValue);
  const heroDateLabel = format(new Date(), 'EEE dd MMM');
  const topGoal = activeGoalSignals[0];
  const coreStats = [
    { label: 'PREDICTION', value: `${prediction.expectedScore}` },
    { label: 'BODY', value: resolvedBodyDisplay },
    { label: 'GOAL', value: topGoal ? `${topGoal.computed.progress}%` : 'NONE' },
  ];
  const systemIntensityLabel = displayScore >= 85 ? 'PEAK LOAD' : displayScore >= 65 ? 'ATTACK READY' : displayScore >= 45 ? 'BUILDING' : 'RECOVERY REQUIRED';
  const commandPills = [
    { label: 'DATE', value: heroDateLabel, tone: 'default' as const },
    { label: 'MODE', value: currentModeName, tone: 'default' as const },
    { label: 'TREND', value: pattern.trend, tone: pattern.trend === 'RISING' ? 'positive' as const : pattern.trend === 'DECLINING' ? 'critical' as const : 'default' as const },
    { label: 'RISK', value: risk.level === 'LOW' ? 'CONTROLLED' : risk.level, tone: risk.level === 'HIGH' ? 'critical' as const : 'default' as const },
  ];
  const summaryCards = [
    { label: 'LIVE SCORE', value: displayScore, suffix: '', note: `${displayState} state` },
    { label: 'EXECUTION', value: executionRate, suffix: '%', note: `${pendingDeepCount} deep tasks queued` },
    { label: 'PREDICTION', value: prediction.expectedScore, suffix: '', note: prediction.trend },
    { label: 'ACTIVE GOAL', value: topGoal ? topGoal.computed.progress : '--', suffix: topGoal ? '%' : '', note: topGoal ? topGoal.goal.title : 'No goal pressure detected' },
  ];
  const commandFeed = [
    ...(actions.slice(0, 2).map((text) => ({ tag: 'ACTION', text, tone: 'default' as const }))),
    ...(suggestions.slice(0, 2).map((item) => ({ tag: 'OPTIMIZE', text: item.message, tone: 'positive' as const }))),
    ...(risk.signals.slice(0, 2).map((text) => ({ tag: 'RISK', text, tone: 'critical' as const }))),
  ].slice(0, 4);
  const breakdownItems = [
    { label: 'Execution', value: todayBreakdown?.execution ?? weeklyAvg?.execution ?? 0, note: pendingDeepCount > 0 ? `${pendingDeepCount} deep tasks still open` : 'Execution load is under control' },
    { label: 'Condition', value: todayBreakdown?.condition ?? weeklyAvg?.condition ?? 0, note: todayEntry?.totalSleepHours ? `${todayEntry.totalSleepHours.toFixed(1)}h sleep logged` : 'Condition will strengthen as recovery data appears' },
    { label: 'Integrity', value: todayBreakdown?.integrity ?? weeklyAvg?.integrity ?? 0, note: topGoal ? `${topGoal.goal.title} driving current pressure` : 'Integrity is reading from plan adherence' },
  ];

  const getSystemLine = (score: number) => {
    if (score > 75) return "All systems aligned. Maintain momentum.";
    if (score > 40) return "System stable. Optimization available.";
    return "System below threshold. Immediate action required.";
  };

  const depth = {
    slow: {},
    medium: {},
    fast: {},
  } as const;
  const visual = useSystemIntensity(displayScore);
  const isCriticalState = displayState === 'CRITICAL' || risk.level === 'HIGH';
  const systemLabel = isCriticalState ? 'CRITICAL • CORE ACTIVE' : 'SYSTEM ONLINE • CORE ACTIVE';

  return (
    <div
      className="dashboard dash-ambient"
      style={{
        position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '32px',
        boxShadow: `0 0 ${12 * visual.glow}px rgba(255,255,255,0.04)`
      }}
    >

      {/* ── REALISM LAYER: Cursor Light ── */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 16%, rgba(255,255,255,0.028), transparent 260px)'
        }}
      />

      <motion.div
        initial={false}
        animate={{
          background: isCriticalState
            ? 'radial-gradient(circle at 50% 18%, rgba(120, 28, 28, 0.12), transparent 52%)'
            : 'radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.015), transparent 52%)',
        }}
        transition={motionConfig.slow}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />

      {/* ── REALISM LAYER: Depth Background ── */}
      <div style={{ ...depth.slow, position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}></div>

      {/* ── SYSTEM PRESENCE HEADER (MEDIUM DEPTH) ── */}
      <section className="dashboard-hero-grid" style={{ ...depth.medium, zIndex: 1, position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...motionConfig.smooth, delay: dashboardSequence.heading }}
          className="dashboard-hero-copy"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={systemLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={motionConfig.smooth}
              className={isCriticalState ? typeStyles.identityLabelCritical : typeStyles.identityLabel}
              style={{ marginBottom: '12px', color: isCriticalState ? 'rgba(255, 140, 140, 0.85)' : undefined }}
            >
              {systemLabel}
            </motion.p>
          </AnimatePresence>
          <motion.h1
            initial={{ opacity: 0, y: 8, letterSpacing: '0.14em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.085em' }}
            transition={{ ...motionConfig.smooth, delay: dashboardSequence.heading + 0.08 }}
            className={`${typeStyles.hero} text-white`}
            style={{ margin: 0, fontSize: 'clamp(42px, 7vw, 82px)', lineHeight: 0.92, fontWeight: 400 }}
          >
            {formatHeadingText(currentModeName)}
          </motion.h1>
          <p className="dashboard-hero-subtext">
            {getSystemLine(displayScore)} The first screen now reflects the live adaptive system across score, execution pressure, recovery condition, and task flow.
          </p>
          <div className="dashboard-command-pill-row">
            {commandPills.map((item) => (
              <CommandPill key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>
        </motion.div>

        <GlassSurface delay={dashboardSequence.cards} variant={isCriticalState ? 'critical' : 'elevated'} className="dashboard-command-deck">
          <div className="dashboard-deck-head">
            <span className={typeStyles.label}>COMMAND DECK</span>
            <span className="dashboard-deck-mode">{systemIntensityLabel}</span>
          </div>
          <div className="dashboard-deck-score-row">
            <div>
              <div className="dashboard-deck-score-label">CURRENT SCORE</div>
              <div className="dashboard-deck-score-value">
                <AnimatedMetric value={displayScore} className="score-number" />
              </div>
            </div>
            <div className="dashboard-deck-state-cluster">
              <span className="dashboard-deck-state">{displayState}</span>
              <span className="dashboard-deck-trend">{prediction.trend}</span>
            </div>
          </div>
          <div className="dashboard-breakdown-stack">
            {breakdownItems.map((item) => (
              <BreakdownRail key={item.label} label={item.label} value={item.value} note={item.note} />
            ))}
          </div>
          <div className="dashboard-feed-stack">
            {commandFeed.length > 0 ? commandFeed.map((item, index) => (
              <FeedLine key={`${item.tag}-${index}`} tag={item.tag} text={item.text} tone={item.tone} />
            )) : (
              <FeedLine tag="READY" text="System feed is clean. More directives will appear as opportunities or risk patterns emerge." />
            )}
          </div>
        </GlassSurface>
      </section>

      {/* ── PRIMARY ZONE (HERO - FAST DEPTH) ── */}
      <section className="dashboard-summary-grid" style={{ ...depth.fast, zIndex: 1, position: 'relative' }}>
        {summaryCards.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionConfig.smooth, delay: dashboardSequence.cards + 0.06 + index * 0.05 }}
          >
            <SummaryMetricCard label={item.label} value={item.value} suffix={item.suffix} note={item.note} />
          </motion.div>
        ))}
      </section>

      <div className="dashboard-primary-grid" style={{ ...depth.fast, zIndex: 1, position: 'relative' }}>
        <GlassSurface i={0} delay={dashboardSequence.score} variant={intensity > 0.8 ? 'critical' : 'elevated'} className="dashboard-core-panel" style={{ minHeight: '312px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
          <div className="dashboard-core-layout">
            <div className="dashboard-core-visual">
              <HeroRadialScore score={displayScore} execution={executionValue} intensity={intensity} />
              <span className={typeStyles.label} style={{ marginTop: '18px', zIndex: 2, opacity: 0.54 }}>SYSTEM SCORE</span>
            </div>
            <div className="dashboard-core-copy">
              <div className="dashboard-core-kicker">SYSTEM CORE</div>
              <div className="dashboard-core-title">{systemIntensityLabel}</div>
              <div className="dashboard-core-text">
                {prediction.expectedScore > 0
                  ? `Forecast is reading ${prediction.expectedScore} with a ${prediction.trend.toLowerCase()} trajectory.`
                  : 'Forecast will sharpen as today receives more structured evidence.'}
              </div>
              <div className="dashboard-core-stats">
                {coreStats.map((item) => (
                  <div key={item.label} className="dashboard-core-stat">
                    <span className="dashboard-core-stat-label">{item.label}</span>
                    <span className="dashboard-core-stat-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassSurface>

        <GlassSurface i={1} delay={dashboardSequence.cards} className="dashboard-terminal-panel dashboard-command-surface" style={{ minHeight: '312px' }}>
          <div className="dashboard-terminal-head">
            <span className={typeStyles.label} style={{ opacity: 0.68 }}>EXECUTION HUD</span>
            <span className="dashboard-terminal-state">{topGoal ? 'GOAL PRESSURE LIVE' : 'SYSTEM FLOW LIVE'}</span>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { label: 'RATE', value: executionRate },
              { label: 'DEEP', value: pendingDeepCount },
              { label: 'LIGHT', value: pendingLightCount },
              { label: 'FOCUS', value: deepWorkDisplay },
              { label: 'BODY', value: resolvedBodyDisplay },
              { label: 'PRED', value: prediction.expectedScore },
            ].map((item) => (
              <div key={item.label} className="dashboard-terminal-row">
                <span className="font-mono dashboard-terminal-label">{item.label}</span>
                <span className="font-mono dashboard-terminal-value">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="dashboard-terminal-rule" />
          <div className="body" style={{ fontSize: '13px', opacity: 0.56, maxWidth: '320px' }}>
            Core execution remains live even while the system is idle. The HUD mirrors score pressure, task load, and body compliance in one surface.
          </div>
        </GlassSurface>
      </div>

      {/* ── SECONDARY GRID (MEDIUM DEPTH) ── */}
      <div className="dashboard-secondary-grid" style={{ ...depth.medium, zIndex: 1, position: 'relative', gridTemplateColumns: 'minmax(0, 1fr)' }}>

        {/* LEFT COMPUTE COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* SYSTEM EVOLUTION LOG (PHASE 4) */}
          {systemEvolutionLogs.length > 0 && (
            <GlassSurface i={4} delay={dashboardSequence.cards + 0.22}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={typeStyles.label}>EVOLUTION LOG</span>
                <span className="font-mono text-[10px] uppercase text-white" style={{ opacity: 0.8 }}>AUTONOMOUS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                {systemEvolutionLogs.map((log: any, idx: number) => (
                  <div key={idx} style={{ paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                    <div className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>
                      {format(parseISO(log.date), 'MMM dd')} — {log.reason.toUpperCase()}
                    </div>
                    <div className={`${typeStyles.body} text-white`} style={{ lineHeight: 1.4, opacity: 0.8 }}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            </GlassSurface>
          )}

          {/* INTELLIGENCE SIGNALS */}
          {(suggestions.length > 0 || risk.signals.length > 0) && (
            <GlassSurface i={7} delay={dashboardSequence.cards + 0.26}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={typeStyles.label}>SYSTEM INTELLIGENCE</span>
                <span className="font-mono text-[10px] uppercase text-white" style={{ opacity: 0.8 }}>{suggestions.length + risk.signals.length} LIVE</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {suggestions.slice(0, 3).map((sig, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>⚡</span>
                      <span className={`${typeStyles.body} text-white`} style={{ lineHeight: 1.4, opacity: 0.9 }}>{sig.message}</span>
                    </div>
                    {sig.actionType && (
                      <button
                        onClick={() => handleApplySuggestion(sig)}
                        className="font-primary-bold text-[12px] uppercase"
                        style={{ background: 'rgba(255,255,255,0.9)', color: '#000', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', marginTop: '12px' }}
                      >
                        APPLY FIX
                      </button>
                    )}
                  </div>
                ))}
                {risk.signals.slice(0, 2).map((signal, idx) => (
                  <div key={`risk-${idx}`} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: 'rgba(255,220,160,0.7)', fontSize: '14px' }}>!</span>
                      <span className={`${typeStyles.body} text-white`} style={{ lineHeight: 1.4, opacity: 0.86 }}>{signal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassSurface>
          )}

        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {allCompleted.length === 0 && !todayEntry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', position: 'relative', overflow: 'hidden', borderRadius: '4px', background: 'rgba(255,255,255,0.008)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="scan-layer" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', zIndex: 2 }}>
            <motion.div animate={{ opacity: [0.24, 0.72, 0.24], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.54)' }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.62)' }}>NO SIGNAL DETECTED</span>
          </div>
          <div style={{ fontSize: '12px', color: '#5A5A5A', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
            <motion.div animate={{ width: ['0%', '100%'] }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }} style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '40px' }} />
            Awaiting input stream
            <motion.div animate={{ width: ['0%', '100%'] }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }} style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '40px' }} />
          </div>
        </motion.div>
      )}

    </div>
  );
}




