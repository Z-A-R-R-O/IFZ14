import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDailyStore } from '../stores/dailyStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { calculateScore, calculateScoreBreakdown } from '../engines/scoreEngine';
import { detectPattern } from '../engines/patternEngine';
import { calculateStreaks } from '../engines/streakEngine';
import { assessRisk } from '../engines/riskEngine';
import { generateSuggestions } from '../engines/suggestionEngine';
import { detectCausation, analyzeFailures, predictOutcome, generateActions } from '../engines/analyticsEngine';
import { computeAllGoals } from '../engines/goalEngine';
import type { DailyEntry } from '../types';
import { useSystemIntensity } from '../system/visual/useSystemIntensity';
import { formatHeadingText, type as typeStyles } from '../typography';
import AnimatedMetric from '../components/AnimatedMetric';
import { dashboardSequence } from '../motion';
import SystemSurface, { type SurfaceVariant } from '../ui/components/SystemSurface';
import { uiMotion } from '../ui/motion/presets';
import { format, parseISO, subDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { normalizeModeName } from '../lib/modeName';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/* ─── Animation Variants ─── */



/* ─── Motion Config ─── */
const motionConfig = {
  fast: uiMotion.fast,
  smooth: uiMotion.smooth,
  slow: uiMotion.slow,
};



/* ─── Glass Surface (Replaces Card) ─── */

function GlassSurface({ children, variant = 'base', className = '', delay = 0, style = {} }: { children: React.ReactNode; i?: number; variant?: SurfaceVariant; className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <SystemSurface variant={variant} className={`dashboard-panel ${className}`.trim()} delay={delay} style={style}>
      {children}
    </SystemSurface>
  );
}

/* ─── Tooltip ─── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px',
      borderRadius: '8px',
    }}>
      <div className={typeStyles.label}>{label?.toUpperCase()}</div>
      <div className="font-mono text-[14px] text-white">{payload[0].value}</div>
    </div>
  );
}

/* ─── Signal Bar HUD ─── */

function SignalBarMap({ label, value, max }: { label: string; value: number; max: number }) {
  const fillWidth = `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span className={typeStyles.label} style={{ width: '48px', opacity: 0.36 }}>{label}</span>
      <div style={{ flex: 1, height: '3px', background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 1px, transparent 1px, transparent 12px)', overflow: 'hidden' }}>
        <motion.div
          layout
          initial={{ width: 0, opacity: 0.72 }}
          animate={{ width: fillWidth, opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.24, 0.9, 0.2, 1] }}
          style={{ height: '100%' }}
          className="signal-bar-fill"
        />
      </div>
      <AnimatedMetric value={value} className="metric-number-xs text-white" style={{ width: '32px', textAlign: 'right', opacity: 0.92 }} />
    </div>
  );
}

/* ─── Diagnostic Row ─── */

function DiagnosticRow({ label, value, state }: { label: string; value: string; state: 'critical'|'stable'|'none' }) {
  const isStatus = label === 'STATUS';
  const intensityStyle = {
    opacity: isStatus ? 0.96 : state === 'critical' ? 1 : state === 'stable' ? 0.7 : 0.4
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <motion.div 
          animate={state === 'critical' ? { opacity: [0.4, 0.85, 0.4] } : state === 'stable' ? { opacity: 0.7 } : { opacity: 0.2 }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{ 
            width: '6px', height: '6px', borderRadius: '50%', 
            background: '#fff', 
            boxShadow: state === 'critical' ? '0 0 4px rgba(255,255,255,0.45)' : 'none',
            opacity: intensityStyle.opacity
          }} 
        />
        <span className={typeStyles.label} style={{ opacity: isStatus ? 0.72 : 0.48 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span className="font-mono text-white" style={{ fontSize: isStatus ? '13px' : '12px', letterSpacing: isStatus ? '0.12em' : '0.08em', opacity: intensityStyle.opacity, fontWeight: isStatus || state === 'critical' ? 600 : 400 }}>{value}</span>
        {state === 'stable' && <motion.span initial={{ x: -2 }} animate={{ x: 0 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }} style={{ color: '#fff', opacity: 0.7, fontSize: '10px' }}>↗</motion.span>}
      </div>
    </div>
  );
}

/* ─── Hero Radial Score ─── */

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
      {/* Outer Ring & Glow */}
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
          cx="92" cy="92" r={radius} fill="none" stroke="#fff" strokeWidth="4"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ delay: 0.16, duration: 0.7, ease: [0.2, 0.88, 0.2, 1] }}
          strokeLinecap="round"
          style={{ strokeDasharray: `${circumference * 0.22} ${circumference * 0.04}` }}
        />
      </svg>
      {/* Inner Core */}
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
      {/* Execution Energy Pulses */}
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

/* ─── Waveform Setup ─── */

function SignalFeedWaveform({ value }: { value: number }) {
  const isActive = value > 0;
  return (
    <motion.svg 
      width="100%" height="60" 
      preserveAspectRatio="none" 
      className="wave"
      style={{ position: 'absolute', bottom: 0, left: 0, opacity: isActive ? 0.15 : 0.03, filter: 'blur(0.3px)' }}
    >
      <motion.path
        d={isActive ? "M0,45 Q20,15 40,45 T80,45 T120,25 T160,45 T200,35 L200,60 L0,60 Z" : "M0,58 L200,58 L200,60 L0,60 Z"}
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: isActive ? 0.52 : 0.18,
        }}
        transition={{
          pathLength: motionConfig.slow,
          opacity: motionConfig.smooth,
        }}
      />
      <motion.path
        d={isActive ? "M0,45 Q20,15 40,45 T80,45 T120,25 T160,45 T200,35 L200,60 L0,60 Z" : "M0,58 L200,58 L200,60 L0,60 Z"}
        fill="rgba(255,255,255,0.1)"
        initial={{ opacity: 0 }}
        animate={{
          opacity: isActive ? [0.04, 0.07, 0.04] : [0.01, 0.02, 0.01],
        }}
        transition={{
          opacity: { duration: isActive ? 6 : 7.2, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
    </motion.svg>
  );
}

/* ─── Chart Placeholder (Signal Lost) ─── */

function ChartPlaceholder({ label = 'NO SIGNAL DETECTED', message = 'Awaiting input stream' }: { label?: string; message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <motion.div animate={{ opacity: [0.28, 0.72, 0.28], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.72)' }} />
        <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.72)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '11px', color: '#5A5A5A', letterSpacing: '0.1em' }}>{message}</span>
    </div>
  );
}

void SignalFeedWaveform;

/* ═══════════════════════════════════════
   DASHBOARD — Fully Dynamic
   ═══════════════════════════════════════ */

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const entries = useDailyStore((s) => s.entries);
  const goals = useGoalStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);
  
  const getActiveTemplateStructure = useDailyStore(s => s.getActiveTemplateStructure);
  const getActiveTemplateName = useDailyStore(s => s.getActiveTemplateName);
  const saveCustomTemplate = useDailyStore(s => s.saveCustomTemplate);
  const setActiveTemplate = useDailyStore(s => s.setActiveTemplate);

  /* ─── Derived Data (all from Zustand store, memoized for performance) ─── */

  const allCompleted = useMemo(() =>
    (Object.values(entries) as any[])
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

  // Last 30 days for score evolution
  const last30Days = useMemo(() => {
    const cutoff = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    return allCompleted.filter((e: any) => e.date >= cutoff);
  }, [allCompleted]);

  /* ─── Engine Calculations (all from real data) ─── */

  const todayScore = useMemo(() =>
    todayEntry ? calculateScore(todayEntry) : null,
    [todayEntry]
  );

  const pattern = useMemo(() => detectPattern(allCompleted), [allCompleted]);
  const streaks = useMemo(() => calculateStreaks(allCompleted), [allCompleted]);
  const risk = useMemo(() => assessRisk(allCompleted), [allCompleted]);
  const suggestions = useMemo(() => generateSuggestions(allCompleted, streaks), [allCompleted, streaks]);
  const insights = useMemo(() => detectCausation(allCompleted), [allCompleted]);
  const failures = useMemo(() => analyzeFailures(allCompleted), [allCompleted]);
  const prediction = useMemo(() => predictOutcome(todayEntry || {}, tasks), [todayEntry, tasks]);
  const actions = useMemo(() => generateActions(insights, failures), [insights, failures]);

  const handleApplySuggestion = (sig: any) => {
    if (sig.actionType === 'switch_template' && sig.actionPayload?.systemType) {
      if (sig.actionPayload.systemType === 'recovery') {
        setActiveTemplate('recovery');
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
      score: Math.round(last7Days.reduce((s: number, e: any) => s + calculateScore(e).score, 0) / n),
      sleep: (last7Days.reduce((s: number, e: any) => s + (e.totalSleepHours || 0), 0) / n).toFixed(1),
      energy: (last7Days.reduce((s: number, e: any) => s + (e.energyLevel || 0), 0) / n).toFixed(1),
      focus: Math.round(last7Days.reduce((s: number, e: any) => s + ((e.dw1FocusQuality || 0) + (e.dw2FocusQuality || 0)) / 2, 0) / n * 10),
      gymDays: last7Days.filter((e: any) => e.gymTraining === 'completed').length,
      output: (last7Days.reduce((s: number, e: any) => s + (e.outputScore || 0), 0) / n).toFixed(1),
    };
  }, [last7Days]);

  /* ─── Chart Data (last 7 days for DW, last 30 for score) ─── */

  const deepWorkChartData = useMemo(() =>
    last7Days.map((e: any) => ({
      date: format(parseISO(e.date), 'MMM dd'),
      focus: Math.round(((e.dw1FocusQuality || 0) + (e.dw2FocusQuality || 0)) / 2 * 10),
      hours: parseFloat(e.dw1Output || '0') || 0,
    })),
    [last7Days]
  );

  const scoreChartData = useMemo(() =>
    last30Days.map((e: any) => ({
      date: format(parseISO(e.date), 'MMM dd'),
      score: calculateScore(e).score,
    })),
    [last30Days]
  );

  const hasDeepWorkChart = last7Days.length >= 2;
  const hasScoreChart = last30Days.length >= 2;

  /* ─── Display Values (today + fallback to weekly avg) ─── */

  const displayScore = todayScore?.score ?? weeklyAvg?.score ?? 0;
  const displayState = todayScore?.state ?? (weeklyAvg ? 'STABLE' : '—');

  const deepWorkDisplay = todayEntry
    ? (((todayEntry.dw1FocusQuality || 0) + (todayEntry.dw2FocusQuality || 0)) / 2 * 10).toFixed(0)
    : weeklyAvg ? `${weeklyAvg.focus}` : '—';

  const gymDisplay = todayEntry?.gymTraining === 'completed'
    ? '✓'
    : todayEntry?.gymTraining === 'partial'
      ? '◐'
      : weeklyAvg ? `${weeklyAvg.gymDays}/7` : '—';

  // Best active streak
  const bestStreak = Math.max(streaks.gym, streaks.deepWork, streaks.earlyWake, streaks.highScore);
  const bestStreakLabel = bestStreak === streaks.gym ? 'GYM'
    : bestStreak === streaks.deepWork ? 'FOCUS'
      : bestStreak === streaks.earlyWake ? 'WAKE'
        : 'SCORE';

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
  const executionValue = todayEntry ? calculateScoreBreakdown(todayEntry).execution : 0;
  const liveTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);
  const pendingDeepCount = liveTasks.filter(task => task.energyType === 'deep').length;
  const pendingLightCount = liveTasks.filter(task => task.energyType !== 'deep').length;
  const executionRate = Math.round(executionValue);

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
      <div style={{ ...depth.medium, marginBottom: '4px', paddingTop: '8px', zIndex: 1, position: 'relative' }}>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...motionConfig.smooth, delay: dashboardSequence.heading }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={systemLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={motionConfig.smooth}
              className={isCriticalState ? typeStyles.identityLabelCritical : typeStyles.identityLabel}
              style={{ marginBottom: '10px', color: isCriticalState ? 'rgba(255, 140, 140, 0.85)' : undefined }}
            >
              {systemLabel}
            </motion.p>
          </AnimatePresence>
          <motion.h1
            initial={{ opacity: 0, y: 8, letterSpacing: '0.14em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.085em' }}
            transition={{ ...motionConfig.smooth, delay: dashboardSequence.heading + 0.08 }}
            className={`${typeStyles.hero} text-white`}
            style={{ margin: 0, fontSize: '44px', lineHeight: 0.94, fontWeight: 400 }}
          >
            {formatHeadingText(currentModeName)}
          </motion.h1>
          <p className={`${typeStyles.body} text-white`} style={{ opacity: 0.62, marginTop: '8px' }}>
            {getSystemLine(displayScore)}
          </p>
        </motion.div>
      </div>

      {/* ── PHASE 8 PREDICTIVE INTELLIGENCE (FAST DEPTH) ── */}
      {false && allCompleted.length >= 5 && (
        <div style={{ ...depth.fast, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '24px', zIndex: 1, position: 'relative' }}>
          <GlassSurface i={0} delay={dashboardSequence.cards} variant="elevated" style={{ background: 'rgba(255,255,255,0.02)' }}>
             <div className={typeStyles.label} style={{ marginBottom: '16px' }}>EXPECTED TODAY</div>
             <div>
                <AnimatedMetric value={prediction.expectedScore} className="metric-number-sm text-white" />
                <div className="font-mono text-[11px] uppercase text-white" style={{ opacity: prediction.trend === 'RISING' ? 1 : prediction.trend === 'FALLING' ? 0.4 : 0.7, marginTop: '4px' }}>
                  ({prediction.trend})
                </div>
             </div>
          </GlassSurface>
          <GlassSurface i={1} delay={dashboardSequence.cards + 0.08} variant="elevated" style={{ border: `1px solid rgba(255,255,255,${visual.border})`, boxShadow: `0 0 ${20 * visual.glow}px rgba(255,255,255,0.1)` }}>
             <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.7 }}>SYSTEM DIRECTIVES</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actions.map((act, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '-2px' }}>•</span>
                    <span className={`${typeStyles.body} text-white`} style={{ lineHeight: 1.4 }}>{act}</span>
                  </div>
                ))}
             </div>
          </GlassSurface>
        </div>
      )}

      {/* ── PRIMARY ZONE (HERO - FAST DEPTH) ── */}
      <div className="dashboard-primary-grid" style={{ ...depth.fast, zIndex: 1, position: 'relative' }}>
        <GlassSurface i={0} delay={dashboardSequence.score} variant={intensity > 0.8 ? 'critical' : 'elevated'} className="dashboard-core-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '312px', border: `1px solid rgba(255,255,255,${visual.border})`, paddingBlock: '18px' }}>
          <HeroRadialScore score={displayScore} execution={executionValue} intensity={intensity} />
          <span className={typeStyles.label} style={{ marginTop: '22px', zIndex: 2, opacity: 0.54 }}>SYSTEM SCORE</span>
        </GlassSurface>

        <GlassSurface i={1} delay={dashboardSequence.cards} className="dashboard-terminal-panel" style={{ minHeight: '312px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '18px', opacity: 0.68 }}>EXECUTION HUD</div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { label: 'RATE', value: executionRate },
              { label: 'DEEP', value: pendingDeepCount },
              { label: 'LIGHT', value: pendingLightCount },
              { label: 'FOCUS', value: deepWorkDisplay },
              { label: 'GYM', value: gymDisplay },
            ].map((item) => (
              <div key={item.label} className="dashboard-terminal-row">
                <span className="font-mono dashboard-terminal-label">{item.label}</span>
                <span className="font-mono dashboard-terminal-value">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="dashboard-terminal-rule" />
          <div className="body" style={{ fontSize: '13px', opacity: 0.56, maxWidth: '240px' }}>
            Core execution remains live even while the system is idle.
          </div>
        </GlassSurface>
      </div>

      {/* ── SECONDARY GRID (MEDIUM DEPTH) ── */}
      <div className="dashboard-secondary-grid" style={{ ...depth.medium, zIndex: 1, position: 'relative' }}>
        
        {/* LEFT COMPUTE COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <GlassSurface i={3} delay={dashboardSequence.cards + 0.12} className="dashboard-scan-panel">
            <div className={typeStyles.label} style={{ marginBottom: '18px' }}>DIAGNOSTICS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DiagnosticRow label="STATUS" value={String(displayState)} state={displayState === 'CRITICAL' ? 'critical' : displayState === 'STABLE' ? 'stable' : 'none'} />
              <DiagnosticRow label="TREND" value={pattern.trend} state={pattern.trend === 'DECLINING' ? 'critical' : pattern.trend === 'RISING' ? 'stable' : 'none'} />
              <DiagnosticRow label="STREAK" value={bestStreak > 0 ? `${bestStreak}D ${bestStreakLabel}` : '—'} state={bestStreak > 3 ? 'stable' : 'none'} />
              <DiagnosticRow label="RISK LEVEL" value={risk.level === 'LOW' ? 'NONE' : risk.level} state={risk.level === 'HIGH' ? 'critical' : risk.level === 'LOW' ? 'stable' : 'none'} />
            </div>
          </GlassSurface>

          <GlassSurface i={8} delay={dashboardSequence.cards + 0.18} className="dashboard-scan-panel">
            <div className={typeStyles.label} style={{ marginBottom: '18px' }}>ACTIVE TARGET</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeGoalSignals.length > 0 ? activeGoalSignals.map(({ goal, computed }) => (
                <div key={goal.id} className="dashboard-goal-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', alignItems: 'baseline' }}>
                    <span className="font-mono" style={{ fontSize: '12px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.88)' }}>{goal.title.replace(/\s+/g, '_').toUpperCase()}</span>
                    <span className="font-mono" style={{ fontSize: '12px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.92)' }}><AnimatedMetric value={computed.progress} pulse={false} />%</span>
                  </div>
                  <div className="dashboard-hard-bar">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${computed.progress}%` }}
                      transition={{ duration: 0.36, ease: [0.24, 0.9, 0.2, 1] }}
                      className="dashboard-hard-bar-fill"
                      style={{ opacity: computed.riskLevel === 'high' ? 0.38 : computed.riskLevel === 'medium' ? 0.66 : 0.92 }}
                    />
                  </div>
                </div>
              )) : (
                <div className={`${typeStyles.body} text-white`} style={{ opacity: 0.52 }}>
                  No active goals locked.
                </div>
              )}
            </div>
          </GlassSurface>

          {/* SYSTEM EVOLUTION LOG (PHASE 4) */}
          {false && systemEvolutionLogs.length > 0 && (
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
          {false && (suggestions.length > 0 || risk.signals.length > 0) && (
            <GlassSurface i={7} delay={dashboardSequence.cards + 0.26}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={typeStyles.label}>SYSTEM INTELLIGENCE</span>
                <span className="font-mono text-[10px] uppercase text-white" style={{ opacity: 0.8 }}>{suggestions.length} ALIVE</span>
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
              </div>
            </GlassSurface>
          )}
        </div>

        {/* RIGHT VISUALS COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* QUICK METRICS HUD */}
          <GlassSurface i={4} delay={dashboardSequence.hud} className="dashboard-scan-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <span className={typeStyles.label}>HUD METRICS</span>
              <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>{todayEntry ? 'TODAY' : weeklyAvg ? 'AVG' : '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <SignalBarMap label="SLEEP" value={todayEntry ? todayEntry.totalSleepHours || 0 : weeklyAvg ? parseFloat(weeklyAvg.sleep) || 0 : 0} max={10} />
              <SignalBarMap label="ENERGY" value={todayEntry ? todayEntry.energyLevel || 0 : weeklyAvg ? parseFloat(weeklyAvg.energy) || 0 : 0} max={10} />
              <SignalBarMap label="FOCUS" value={todayEntry ? Math.round(((todayEntry.dw1FocusQuality || 0) + (todayEntry.dw2FocusQuality || 0)) / 2 * 10) : weeklyAvg ? weeklyAvg.focus || 0 : 0} max={100} />
              <SignalBarMap label="OUTPUT" value={todayEntry ? todayEntry.outputScore || 0 : weeklyAvg ? parseFloat(weeklyAvg.output) || 0 : 0} max={10} />
            </div>
          </GlassSurface>

          {/* DEEP WORK EVOLUTION */}
          <GlassSurface i={5} delay={dashboardSequence.hud + 0.08} className="dashboard-scan-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <span className={typeStyles.label}>FOCUS SIGNAL</span>
              <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>7D</span>
            </div>
            <div style={{ height: 180 }} className="dashboard-chart-shell">
              {hasDeepWorkChart ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deepWorkChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="dwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'transparent' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                    <Area type="monotone" dataKey="focus" stroke="rgba(255,255,255,0.4)" strokeWidth={2} fill="url(#dwGrad)" dot={{ fill: '#fff', r: 2, strokeWidth: 0 }} activeDot={{ fill: '#fff', r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
          </GlassSurface>

          {/* SCORE EVOLUTION */}
          <GlassSurface i={6} delay={dashboardSequence.hud + 0.16} className="dashboard-scan-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <span className={typeStyles.label}>TIMELINE</span>
              <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>30D</span>
            </div>
            <div style={{ height: 180 }} className="dashboard-chart-shell">
              {hasScoreChart ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'transparent' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                    <Line type="monotone" dataKey="score" stroke="rgba(255,255,255,0.4)" strokeWidth={2} dot={{ fill: '#fff', r: 2, strokeWidth: 0 }} activeDot={{ fill: '#fff', r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder label="BASELINE FORMING..." message="Awaiting score history" />
              )}
            </div>
          </GlassSurface>
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
