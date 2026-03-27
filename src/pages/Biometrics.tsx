import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { useBiometricStore } from '../stores/biometricStore';
import { useDailyStore } from '../stores/dailyStore';
import {
  calcBMI,
  calcBMR,
  calcCalorieTarget,
  calcLeanMass,
  calcMacroSplit,
  calcTDEE,
  calcWeightTrend,
  calcWeeklyDelta,
  calcWorkoutStats,
  getBMICategory,
} from '../engines/biometricEngine';
import { type as typeStyles } from '../typography';
import SystemSurface from '../ui/components/SystemSurface';
import { fadeInUp } from '../ui/motion/presets';
import AnimatedMetric from '../components/AnimatedMetric';
import type { BiometricProfile, BodyHabit, DailyEntry, WorkoutLogEntry } from '../types';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function parseTimeToMinutes(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDelta(value: number | null, unit = 'KG') {
  if (value == null) return '--';
  if (value === 0) return `0 ${unit}`;
  return `${value > 0 ? '+' : ''}${value} ${unit}`;
}

function getGoalLabel(goalType: BiometricProfile['goalType']) {
  if (goalType === 'cut') return 'Cutting';
  if (goalType === 'bulk') return 'Building';
  return 'Maintaining';
}

function getActivityLabel(level: BiometricProfile['activityLevel']) {
  if (level === 'sedentary') return 'Sedentary';
  if (level === 'light') return 'Light';
  if (level === 'moderate') return 'Moderate';
  if (level === 'active') return 'Active';
  return 'Intense';
}

function getHabitTypeLabel(type: BodyHabit['type']) {
  if (type === 'toggle') return 'Yes / No';
  if (type === 'rating') return 'Scale';
  return 'Minutes';
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="biometrics-control-row">
      <span className="biometrics-control-copy">
        <span className={typeStyles.label}>{label}</span>
        <span className="biometrics-control-hint">{hint}</span>
      </span>
      <span className="biometrics-control-shell">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = parseFloat(event.target.value);
            onChange(clamp(Number.isFinite(next) ? next : min, min, max));
          }}
          className="biometrics-input"
        />
        {suffix ? <span className="biometrics-input-suffix">{suffix}</span> : null}
      </span>
    </label>
  );
}

function SelectInput({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="biometrics-control-row">
      <span className="biometrics-control-copy">
        <span className={typeStyles.label}>{label}</span>
        <span className="biometrics-control-hint">{hint}</span>
      </span>
      <span className="biometrics-control-shell">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="biometrics-input biometrics-select">
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function MetricTile({
  label,
  value,
  suffix,
  detail,
  delay = 0,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  detail?: string;
  delay?: number;
}) {
  return (
    <motion.div {...fadeInUp(delay, 8)} className="biometrics-metric-tile">
      <span className={typeStyles.label}>{label}</span>
      <div className="biometrics-metric-value">
        {typeof value === 'number' ? (
          <AnimatedMetric value={value} className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)' }} />
        ) : (
          <span className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)' }}>
            {value}
          </span>
        )}
        {suffix ? <span className="biometrics-metric-suffix">{suffix}</span> : null}
      </div>
      {detail ? <span className="biometrics-metric-detail">{detail}</span> : null}
    </motion.div>
  );
}

function DataBar({
  label,
  value,
  total,
  accent,
  detail,
  delay = 0,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
  detail: string;
  delay?: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <motion.div {...fadeInUp(delay, 8)} className="biometrics-bar-block">
      <div className="biometrics-bar-head">
        <span className="font-mono biometrics-bar-label">{label}</span>
        <span className="font-mono biometrics-bar-value">{detail}</span>
      </div>
      <div className="biometrics-bar-track">
        <motion.div
          className="biometrics-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: accent }}
        />
      </div>
    </motion.div>
  );
}

function WeightChart({ trend }: { trend: { date: string; avg: number }[] }) {
  if (trend.length < 2) {
    return <div className="biometrics-empty-state">Log at least two weigh-ins to unlock the trend line.</div>;
  }

  const width = 640;
  const height = 220;
  const pad = 26;
  const values = trend.map((item) => item.avg);
  const min = Math.min(...values) - 0.7;
  const max = Math.max(...values) + 0.7;
  const range = Math.max(max - min, 1);

  const points = trend.map((item, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(trend.length - 1, 1);
    const y = height - pad - ((item.avg - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${height - pad} L ${points[0].x.toFixed(1)} ${height - pad} Z`;
  const labelIndexes = trend
    .map((_, index) => index)
    .filter((index) => index === 0 || index === trend.length - 1 || index % Math.max(1, Math.floor(trend.length / 4)) === 0);

  return (
    <div className="biometrics-chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="biometrics-chart">
        <defs>
          <linearGradient id="biometricsWeightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
          </linearGradient>
        </defs>

        {[0.2, 0.4, 0.6, 0.8].map((level) => (
          <line
            key={level}
            x1={pad}
            x2={width - pad}
            y1={height - pad - level * (height - pad * 2)}
            y2={height - pad - level * (height - pad * 2)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill="url(#biometricsWeightFill)" />
        <motion.path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.82)"
          strokeWidth="2.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        {points.map((point, index) => (
          <circle key={`${trend[index].date}-${index}`} cx={point.x} cy={point.y} r="3.2" fill="rgba(255,255,255,0.92)" />
        ))}

        {labelIndexes.map((index) => (
          <text
            key={trend[index].date}
            x={points[index].x}
            y={height - 7}
            textAnchor="middle"
            fill="rgba(255,255,255,0.34)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em' }}
          >
            {trend[index].date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

const TABS = [
  { id: 'habits', label: 'Habits', detail: 'Protocol manager' },
  { id: 'nutrition', label: 'Nutrition', detail: 'Profile and fuel' },
  { id: 'weight', label: 'Weight', detail: 'Trend archive' },
  { id: 'workouts', label: 'Workouts', detail: 'Training log' },
  { id: 'composition', label: 'Composition', detail: 'Mass breakdown' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function HabitBoard() {
  const habits = useBiometricStore((state) => state.habits);
  const addHabit = useBiometricStore((state) => state.addHabit);
  const removeHabit = useBiometricStore((state) => state.removeHabit);
  const toggleHabitActive = useBiometricStore((state) => state.toggleHabitActive);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'toggle' | 'rating' | 'duration'>('toggle');

  const sortedHabits = useMemo(() => [...habits].sort((left, right) => left.order - right.order), [habits]);
  const activeCount = sortedHabits.filter((habit) => habit.isActive).length;
  const coverage = sortedHabits.length > 0 ? Math.round((activeCount / sortedHabits.length) * 100) : 0;

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addHabit({ name: trimmed, type: newType, icon: '', isActive: true });
    setNewName('');
    setNewType('toggle');
  };

  return (
    <div className="biometrics-stack">
      <SystemSurface as="section" interactive={false} delay={0.06} className="biometrics-surface">
        <div className="biometrics-section-head">
          <div>
            <div className={typeStyles.label}>Protocol Status</div>
            <div className="biometrics-section-title">Body system stays cleaner when the stack is deliberate.</div>
          </div>
          <div className="biometrics-mini-grid">
            <MetricTile label="ACTIVE" value={activeCount} detail="Live protocols" />
            <MetricTile label="TOTAL" value={sortedHabits.length} detail="Tracked habits" />
            <MetricTile label="COVERAGE" value={coverage} suffix="%" detail="Active share" />
          </div>
        </div>
      </SystemSurface>

      <div className="biometrics-grid biometrics-grid--split">
        <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
          <div className="biometrics-surface-heading">
            <div className={typeStyles.label}>Create Protocol</div>
            <div className="biometrics-surface-copy">Add one clean behavior at a time. Keep naming tight so it reads well inside Daily tracking.</div>
          </div>

          <div className="biometrics-form-stack">
            <label className="biometrics-field">
              <span className={typeStyles.label}>Habit Name</span>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAdd();
                }}
                placeholder="Morning mobility, cold shower, jawline work"
                className="biometrics-input biometrics-input--full"
              />
            </label>

            <label className="biometrics-field">
              <span className={typeStyles.label}>Measurement Mode</span>
              <select value={newType} onChange={(event) => setNewType(event.target.value as typeof newType)} className="biometrics-input biometrics-select biometrics-input--full">
                <option value="toggle">Yes / No</option>
                <option value="rating">Scale</option>
                <option value="duration">Minutes</option>
              </select>
            </label>

            <button type="button" onClick={handleAdd} className="biometrics-button">
              Add Protocol
            </button>
          </div>
        </SystemSurface>

        <SystemSurface as="section" interactive={false} delay={0.14} className="biometrics-surface">
          <div className="biometrics-surface-heading">
            <div className={typeStyles.label}>Protocol Roster</div>
            <div className="biometrics-surface-copy">The roster mirrors the body page identity: fewer, sharper, always visible.</div>
          </div>

          <div className="biometrics-list">
            {sortedHabits.map((habit) => (
              <div key={habit.id} className="biometrics-list-row">
                <div className="biometrics-list-main">
                  <div className="biometrics-list-title-row">
                    <span className="biometrics-list-title">{habit.name}</span>
                    <span className={`biometrics-status ${habit.isActive ? 'is-active' : 'is-off'}`}>
                      {habit.isActive ? 'Active' : 'Muted'}
                    </span>
                  </div>
                  <div className="biometrics-list-meta">{getHabitTypeLabel(habit.type)}</div>
                </div>

                <div className="biometrics-list-actions">
                  <button type="button" onClick={() => toggleHabitActive(habit.id)} className="biometrics-button biometrics-button--secondary">
                    {habit.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" onClick={() => removeHabit(habit.id)} className="biometrics-icon-button" aria-label={`Remove ${habit.name}`}>
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SystemSurface>
      </div>
    </div>
  );
}

export default function Biometrics() {
  const [activeTab, setActiveTab] = useState<TabId>('habits');

  const profile = useBiometricStore((state) => state.profile);
  const weightLog = useBiometricStore((state) => state.weightLog);
  const workoutLog = useBiometricStore((state) => state.workoutLog);
  const habits = useBiometricStore((state) => state.habits);
  const updateProfile = useBiometricStore((state) => state.updateProfile);
  const addWeightEntry = useBiometricStore((state) => state.addWeightEntry);
  const removeWeightEntry = useBiometricStore((state) => state.removeWeightEntry);
  const addWorkout = useBiometricStore((state) => state.addWorkout);
  const removeWorkout = useBiometricStore((state) => state.removeWorkout);
  const dailyEntries = useDailyStore((state) => state.entries);

  const today = format(new Date(), 'yyyy-MM-dd');

  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [workoutName, setWorkoutName] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutLogEntry['type']>('strength');
  const [workoutDuration, setWorkoutDuration] = useState('45');
  const [workoutIntensity, setWorkoutIntensity] = useState('7');

  const bmr = useMemo(() => calcBMR(profile), [profile]);
  const tdee = useMemo(() => calcTDEE(bmr, profile.activityLevel), [bmr, profile.activityLevel]);
  const calorieTarget = useMemo(() => calcCalorieTarget(tdee, profile.goalType), [tdee, profile.goalType]);
  const macros = useMemo(() => calcMacroSplit(calorieTarget, profile.goalType, profile.weightKg), [calorieTarget, profile.goalType, profile.weightKg]);
  const bmi = useMemo(() => calcBMI(profile.heightCm, profile.weightKg), [profile.heightCm, profile.weightKg]);
  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);
  const leanMass = useMemo(() => calcLeanMass(profile.weightKg, profile.bodyFatPercent), [profile.weightKg, profile.bodyFatPercent]);
  const fatMass = leanMass != null ? Math.round((profile.weightKg - leanMass) * 10) / 10 : null;
  const weightTrend = useMemo(() => calcWeightTrend(weightLog), [weightLog]);
  const weeklyDelta = useMemo(() => calcWeeklyDelta(weightLog), [weightLog]);
  const workoutStats = useMemo(() => calcWorkoutStats(workoutLog), [workoutLog]);

  const sortedHabits = useMemo(() => [...habits].sort((left, right) => left.order - right.order), [habits]);
  const activeHabitCount = sortedHabits.filter((habit) => habit.isActive).length;
  const latestWeightEntry = weightLog[weightLog.length - 1];
  const firstWeightEntry = weightLog[0];
  const latestWeight = latestWeightEntry?.weightKg ?? profile.weightKg;
  const totalDelta = firstWeightEntry ? Math.round((latestWeight - firstWeightEntry.weightKg) * 10) / 10 : 0;
  const latestWorkout = workoutLog[workoutLog.length - 1];
  const leanRatio = leanMass != null ? Math.round((leanMass / profile.weightKg) * 100) : 0;
  const bodyFatPercent = profile.bodyFatPercent ?? 0;

  const handleProfileUpdate = (key: keyof BiometricProfile, value: number | string) => {
    updateProfile({ [key]: value } as Partial<BiometricProfile>);
  };

  const handleAddWeight = () => {
    const weight = parseFloat(newWeight);
    if (!Number.isFinite(weight) || weight <= 0) return;

    const bodyFat = parseFloat(newBodyFat);
    const parsedBodyFat = Number.isFinite(bodyFat) && bodyFat > 0 ? bodyFat : undefined;

    addWeightEntry({ date: today, weightKg: weight, bodyFatPercent: parsedBodyFat });
    updateProfile({ weightKg: weight, ...(parsedBodyFat ? { bodyFatPercent: parsedBodyFat } : {}) });
    setNewWeight('');
    setNewBodyFat('');
  };

  const handleAddWorkout = () => {
    const trimmed = workoutName.trim();
    if (!trimmed) return;

    addWorkout({
      date: today,
      type: workoutType,
      name: trimmed,
      durationMin: Math.max(1, parseInt(workoutDuration, 10) || 45),
      intensity: clamp(parseInt(workoutIntensity, 10) || 7, 1, 10),
    });

    setWorkoutName('');
  };

  const recentWeights = weightLog.slice(-6).reverse();
  const recentWorkouts = workoutLog.slice(-6).reverse();
  const completedDailyEntries = useMemo(
    () =>
      (Object.values(dailyEntries) as DailyEntry[])
        .filter((entry) => entry.completed)
        .sort((left, right) => left.date.localeCompare(right.date)),
    [dailyEntries]
  );
  const recentSleepEntries = useMemo(
    () => completedDailyEntries.filter((entry) => (entry.totalSleepHours || 0) > 0).slice(-7),
    [completedDailyEntries]
  );
  const sleepTarget = 7.5;
  const sleepAverage = useMemo(
    () =>
      recentSleepEntries.length > 0
        ? Math.round((recentSleepEntries.reduce((sum, entry) => sum + (entry.totalSleepHours || 0), 0) / recentSleepEntries.length) * 10) / 10
        : 0,
    [recentSleepEntries]
  );
  const sleepDebt = useMemo(
    () =>
      recentSleepEntries.length > 0
        ? Math.round((sleepTarget * recentSleepEntries.length - recentSleepEntries.reduce((sum, entry) => sum + (entry.totalSleepHours || 0), 0)) * 10) / 10
        : 0,
    [recentSleepEntries]
  );
  const wakeStability = useMemo(() => {
    const wakeMinutes = recentSleepEntries
      .map((entry) => parseTimeToMinutes(entry.actualWakeTime))
      .filter((value): value is number => value !== null);
    if (wakeMinutes.length < 2) return null;
    const diffs = wakeMinutes.slice(1).map((value, index) => Math.abs(value - wakeMinutes[index]));
    const avgDiff = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
    return clamp(Math.round(100 - avgDiff), 0, 100);
  }, [recentSleepEntries]);
  const sleepCycleState = useMemo(() => {
    if (recentSleepEntries.length === 0) return { label: 'UNTRACKED', tone: 'rgba(255,255,255,0.52)' };
    if (sleepAverage < 6.8) return { label: 'SLEEP DEBT', tone: 'rgba(255,132,132,0.92)' };
    if (sleepAverage > 8.2) return { label: 'OVERSHOOT', tone: 'rgba(255,212,138,0.92)' };
    if (Math.abs(sleepAverage - sleepTarget) <= 0.3) return { label: 'TARGET LOCK', tone: 'rgba(168,219,188,0.92)' };
    return { label: 'DRIFT', tone: 'rgba(255,255,255,0.82)' };
  }, [recentSleepEntries.length, sleepAverage]);
  const sleepAnalysis = useMemo(() => {
    if (recentSleepEntries.length === 0) {
      return [
        'Sleep analysis activates after you log sleep inside Daily.',
        'Target is set to 7.5 hours so the body page can measure drift cleanly.',
      ];
    }

    const lines = [
      Math.abs(sleepAverage - sleepTarget) <= 0.3
        ? 'Sleep is holding near 7.5h, which supports cleaner recovery and steadier execution.'
        : sleepAverage < sleepTarget
          ? `Average sleep is ${sleepAverage}h, below the 7.5h target and likely adding recovery drag.`
          : `Average sleep is ${sleepAverage}h, above the 7.5h target and worth checking against energy quality.`,
      wakeStability != null && wakeStability >= 85
        ? 'Wake timing is stable, so your sleep cycle is compounding instead of drifting.'
        : 'Wake timing is inconsistent, so the cycle is noisier even when total sleep looks acceptable.',
      sleepDebt > 0.5
        ? `${sleepDebt}h of recent sleep debt is still open. Closing that gap should improve body-state stability.`
        : 'No meaningful sleep debt is building across the recent window.',
    ];

    return lines;
  }, [recentSleepEntries.length, sleepAverage, wakeStability, sleepDebt]);

  return (
    <div className="biometrics-page">
      <motion.section {...fadeInUp(0, 10)} className="biometrics-hero-grid">
        <div className="biometrics-hero-copy">
          <div className={typeStyles.identityLabel}>BODY SYSTEM</div>
          <h1 className={typeStyles.hero}>Biometric Control</h1>
          <p className={typeStyles.body}>
            Rebuilt to match the rest of the system: cleaner hierarchy, premium surfaces, and a sharper view of habits,
            training, intake, and composition.
          </p>

          <div className="biometrics-chip-row">
            <span className="biometrics-chip">Goal {getGoalLabel(profile.goalType)}</span>
            <span className="biometrics-chip">Activity {getActivityLabel(profile.activityLevel)}</span>
            <span className="biometrics-chip">
              {latestWeightEntry ? `Latest ${formatShortDate(latestWeightEntry.date)}` : 'Profile baseline only'}
            </span>
          </div>
        </div>

        <SystemSurface as="section" interactive={false} delay={0.08} className="biometrics-hero-surface">
          <div className="biometrics-surface-heading">
            <div className={typeStyles.label}>Overview Pulse</div>
            <div className="biometrics-surface-copy">
              {latestWorkout
                ? `Last workout logged ${formatShortDate(latestWorkout.date)}. Weight trend and intake engine are live.`
                : 'No workout archive yet. Start logging sessions to activate the full body dashboard.'}
            </div>
          </div>

          <div className="biometrics-hero-metrics">
            <MetricTile label="TARGET" value={calorieTarget} suffix="KCAL" detail="Daily intake" delay={0.1} />
            <MetricTile label="WEIGHT" value={latestWeight} suffix="KG" detail="Current bodyweight" delay={0.12} />
            <MetricTile label="SHIFT" value={formatDelta(weeklyDelta)} detail="7-day change" delay={0.14} />
            <MetricTile label="ACTIVE HABITS" value={activeHabitCount} detail="Live protocols" delay={0.16} />
          </div>
        </SystemSurface>
      </motion.section>

      <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
        <div className="biometrics-section-head">
          <div>
            <div className={typeStyles.label}>Sleep Cycle Effects</div>
            <div className="biometrics-section-title">Sleep is analyzed against a 7.5 hour maintenance target.</div>
          </div>
          <div className="biometrics-mini-grid">
            <MetricTile label="AVG SLEEP" value={sleepAverage || '--'} suffix={sleepAverage ? 'H' : undefined} detail="Recent 7 logged days" />
            <MetricTile label="TARGET DRIFT" value={recentSleepEntries.length ? Math.abs(Math.round((sleepAverage - sleepTarget) * 10) / 10) : '--'} suffix={recentSleepEntries.length ? 'H' : undefined} detail="Distance from 7.5h" />
            <MetricTile label="WAKE STABILITY" value={wakeStability ?? '--'} suffix={wakeStability != null ? '%' : undefined} detail="Wake-time consistency" />
            <MetricTile label="CYCLE STATE" value={sleepCycleState.label} detail="Recovery pattern" />
          </div>
        </div>

        <div className="biometrics-divider" />

        <div className="biometrics-insight-list">
          {sleepAnalysis.map((line) => (
            <div key={line} className="goal-insight-line" style={{ color: sleepCycleState.tone }}>
              {line}
            </div>
          ))}
        </div>
      </SystemSurface>

      <motion.div {...fadeInUp(0.04, 8)} className="biometrics-tab-rail">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`biometrics-tab ${activeTab === tab.id ? 'is-active' : ''}`}
          >
            <span className="biometrics-tab-label">{tab.label}</span>
            <span className="biometrics-tab-detail">{tab.detail}</span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="biometrics-tab-content"
        >
          {activeTab === 'habits' ? <HabitBoard /> : null}

          {activeTab === 'nutrition' ? (
            <div className="biometrics-stack">
              <SystemSurface as="section" interactive={false} delay={0.06} className="biometrics-surface">
                <div className="biometrics-section-head">
                  <div>
                    <div className={typeStyles.label}>Fuel Blueprint</div>
                    <div className="biometrics-section-title">Your calorie and macro targets now sit inside the same premium frame as the rest of the app.</div>
                  </div>
                  <div className="biometrics-mini-grid">
                    <MetricTile label="BMR" value={bmr} suffix="KCAL" detail="Base demand" />
                    <MetricTile label="TDEE" value={tdee} suffix="KCAL" detail="Daily expenditure" />
                    <MetricTile label="BMI" value={bmi} detail={bmiCategory} />
                  </div>
                </div>
              </SystemSurface>

              <div className="biometrics-grid biometrics-grid--split">
                <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Profile Inputs</div>
                    <div className="biometrics-surface-copy">Core measurements and metabolic context feed every calculation on this page.</div>
                  </div>

                  <div className="biometrics-control-list">
                    <NumberInput label="Height" hint="Frame baseline" value={profile.heightCm} onChange={(value) => handleProfileUpdate('heightCm', value)} min={100} max={250} suffix="CM" />
                    <NumberInput label="Weight" hint="Current bodyweight" value={profile.weightKg} onChange={(value) => handleProfileUpdate('weightKg', value)} min={30} max={300} step={0.1} suffix="KG" />
                    <NumberInput label="Age" hint="Metabolic age input" value={profile.age} onChange={(value) => handleProfileUpdate('age', value)} min={10} max={100} suffix="YR" />
                    <NumberInput label="Body Fat" hint="Optional composition input" value={profile.bodyFatPercent || 0} onChange={(value) => updateProfile({ bodyFatPercent: value || undefined })} min={0} max={60} step={0.1} suffix="%" />
                    <SelectInput label="Gender" hint="BMR model switch" value={profile.gender} onChange={(value) => handleProfileUpdate('gender', value)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
                    <SelectInput label="Activity" hint="Daily load tier" value={profile.activityLevel} onChange={(value) => handleProfileUpdate('activityLevel', value)} options={[{ value: 'sedentary', label: 'Sedentary' }, { value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'active', label: 'Active' }, { value: 'intense', label: 'Intense' }]} />
                    <SelectInput label="Goal" hint="Calorie target mode" value={profile.goalType} onChange={(value) => handleProfileUpdate('goalType', value)} options={[{ value: 'cut', label: 'Cut' }, { value: 'maintain', label: 'Maintain' }, { value: 'bulk', label: 'Bulk' }]} />
                  </div>
                </SystemSurface>

                <SystemSurface as="section" interactive={false} delay={0.14} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Nutrition Engine</div>
                    <div className="biometrics-surface-copy">The intake target adapts to your selected activity tier and body goal.</div>
                  </div>

                  <div className="reports-metric-grid">
                    <MetricTile label="TARGET" value={calorieTarget} suffix="KCAL" detail={`${getGoalLabel(profile.goalType)} mode`} delay={0.16} />
                    <MetricTile label="ACTIVITY" value={getActivityLabel(profile.activityLevel)} detail="Load tier" delay={0.18} />
                    <MetricTile label="BODY FAT" value={profile.bodyFatPercent ?? '--'} suffix={profile.bodyFatPercent ? '%' : undefined} detail="Optional input" delay={0.2} />
                  </div>

                  <div className="biometrics-divider" />

                  <div className="biometrics-stack biometrics-stack--tight">
                    <DataBar label="PROTEIN" value={macros.protein * 4} total={calorieTarget} accent="linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.42))" detail={`${macros.protein}G`} delay={0.22} />
                    <DataBar label="CARBS" value={macros.carbs * 4} total={calorieTarget} accent="linear-gradient(90deg, rgba(255,255,255,0.68), rgba(255,255,255,0.2))" detail={`${macros.carbs}G`} delay={0.24} />
                    <DataBar label="FAT" value={macros.fat * 9} total={calorieTarget} accent="linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12))" detail={`${macros.fat}G`} delay={0.26} />
                  </div>
                </SystemSurface>
              </div>
            </div>
          ) : null}

          {activeTab === 'weight' ? (
            <div className="biometrics-stack">
              <SystemSurface as="section" interactive={false} delay={0.06} className="biometrics-surface">
                <div className="biometrics-section-head">
                  <div>
                    <div className={typeStyles.label}>Weight Archive</div>
                    <div className="biometrics-section-title">Trend view, quick logging, and recent weigh-ins are now grouped into one clean system.</div>
                  </div>
                  <div className="biometrics-mini-grid">
                    <MetricTile label="CURRENT" value={latestWeight} suffix="KG" detail="Latest reading" />
                    <MetricTile label="TOTAL SHIFT" value={formatDelta(totalDelta)} detail="Since first log" />
                    <MetricTile label="WEEKLY" value={formatDelta(weeklyDelta)} detail="7-day signal" />
                  </div>
                </div>
              </SystemSurface>

              <div className="biometrics-grid biometrics-grid--split-wide">
                <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Trend Curve</div>
                    <div className="biometrics-surface-copy">Moving average view stabilizes the signal and keeps daily noise out of the hero layer.</div>
                  </div>
                  <WeightChart trend={weightTrend} />
                </SystemSurface>

                <SystemSurface as="section" interactive={false} delay={0.14} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Log Today</div>
                    <div className="biometrics-surface-copy">Capture one clear measurement. The profile updates immediately from the latest weight entry.</div>
                  </div>

                  <div className="biometrics-form-stack">
                    <div className="biometrics-inline-fields">
                      <input type="number" step="0.1" placeholder="Weight" value={newWeight} onChange={(event) => setNewWeight(event.target.value)} className="biometrics-input biometrics-input--full" />
                      <input type="number" step="0.1" placeholder="Body fat %" value={newBodyFat} onChange={(event) => setNewBodyFat(event.target.value)} className="biometrics-input biometrics-input--full" />
                    </div>

                    <button type="button" onClick={handleAddWeight} className="biometrics-button">
                      Log Weight
                    </button>
                  </div>

                  <div className="biometrics-divider" />

                  <div className="biometrics-list">
                    {recentWeights.length > 0 ? recentWeights.map((entry) => (
                      <div key={entry.date} className="biometrics-list-row">
                        <div className="biometrics-list-main">
                          <div className="biometrics-list-title-row">
                            <span className="biometrics-list-title">{entry.weightKg} KG</span>
                            <span className="biometrics-list-meta">{formatShortDate(entry.date)}</span>
                          </div>
                          <div className="biometrics-list-meta">{entry.bodyFatPercent != null ? `${entry.bodyFatPercent}% body fat` : 'No body fat value'}</div>
                        </div>

                        <button type="button" onClick={() => removeWeightEntry(entry.date)} className="biometrics-icon-button" aria-label={`Remove weight log for ${entry.date}`}>
                          x
                        </button>
                      </div>
                    )) : <div className="biometrics-empty-state">No weigh-ins stored yet.</div>}
                  </div>
                </SystemSurface>
              </div>
            </div>
          ) : null}

          {activeTab === 'workouts' ? (
            <div className="biometrics-stack">
              <SystemSurface as="section" interactive={false} delay={0.06} className="biometrics-surface">
                <div className="biometrics-section-head">
                  <div>
                    <div className={typeStyles.label}>Training Board</div>
                    <div className="biometrics-section-title">Session data now reads like the rest of the product: compressed, sharp, and easy to scan.</div>
                  </div>
                  <div className="biometrics-mini-grid">
                    <MetricTile label="SESSIONS" value={workoutStats.sessions} detail="Last 7 days" />
                    <MetricTile label="VOLUME" value={workoutStats.totalMinutes} suffix="MIN" detail="Tracked duration" />
                    <MetricTile label="INTENSITY" value={workoutStats.avgIntensity} suffix="/10" detail="Average effort" />
                    <MetricTile label="CALORIES" value={workoutStats.totalCalories} suffix="KCAL" detail="Estimated burn" />
                  </div>
                </div>
              </SystemSurface>

              <div className="biometrics-grid biometrics-grid--split">
                <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Add Session</div>
                    <div className="biometrics-surface-copy">Log strength, cardio, sport, mobility, or any custom work block.</div>
                  </div>

                  <div className="biometrics-form-stack">
                    <input value={workoutName} onChange={(event) => setWorkoutName(event.target.value)} placeholder="Session name" className="biometrics-input biometrics-input--full" />

                    <div className="biometrics-inline-fields biometrics-inline-fields--triple">
                      <select value={workoutType} onChange={(event) => setWorkoutType(event.target.value as WorkoutLogEntry['type'])} className="biometrics-input biometrics-select biometrics-input--full">
                        <option value="strength">Strength</option>
                        <option value="cardio">Cardio</option>
                        <option value="flexibility">Flexibility</option>
                        <option value="sport">Sport</option>
                        <option value="other">Other</option>
                      </select>
                      <input type="number" value={workoutDuration} onChange={(event) => setWorkoutDuration(event.target.value)} placeholder="Minutes" className="biometrics-input biometrics-input--full" />
                      <input type="number" min="1" max="10" value={workoutIntensity} onChange={(event) => setWorkoutIntensity(event.target.value)} placeholder="Intensity" className="biometrics-input biometrics-input--full" />
                    </div>

                    <button type="button" onClick={handleAddWorkout} className="biometrics-button">
                      Log Workout
                    </button>
                  </div>
                </SystemSurface>

                <SystemSurface as="section" interactive={false} delay={0.14} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Recent Sessions</div>
                    <div className="biometrics-surface-copy">
                      {latestWorkout ? `Latest session: ${latestWorkout.name} on ${formatShortDate(latestWorkout.date)}.` : 'No workouts recorded yet.'}
                    </div>
                  </div>

                  <div className="biometrics-list">
                    {recentWorkouts.length > 0 ? recentWorkouts.map((entry, index) => (
                      <div key={`${entry.date}-${entry.name}-${index}`} className="biometrics-list-row">
                        <div className="biometrics-list-main">
                          <div className="biometrics-list-title-row">
                            <span className="biometrics-list-title">{entry.name}</span>
                            <span className="biometrics-list-meta">{formatShortDate(entry.date)}</span>
                          </div>
                          <div className="biometrics-list-meta">
                            {entry.type} | {entry.durationMin} min | intensity {entry.intensity}/10
                          </div>
                        </div>

                        <button type="button" onClick={() => removeWorkout(entry.date, entry.name)} className="biometrics-icon-button" aria-label={`Remove workout ${entry.name}`}>
                          x
                        </button>
                      </div>
                    )) : <div className="biometrics-empty-state">Training log is empty.</div>}
                  </div>
                </SystemSurface>
              </div>
            </div>
          ) : null}

          {activeTab === 'composition' ? (
            <div className="biometrics-stack">
              <SystemSurface as="section" interactive={false} delay={0.06} className="biometrics-surface">
                <div className="biometrics-section-head">
                  <div>
                    <div className={typeStyles.label}>Composition View</div>
                    <div className="biometrics-section-title">Mass, ratio, and metabolic context are aligned into a single body profile layer.</div>
                  </div>
                  <div className="biometrics-mini-grid">
                    <MetricTile label="BMI" value={bmi} detail={bmiCategory} />
                    <MetricTile label="LEAN RATIO" value={leanMass != null ? leanRatio : '--'} suffix={leanMass != null ? '%' : undefined} detail="Bodyweight share" />
                    <MetricTile label="BODY FAT" value={profile.bodyFatPercent ?? '--'} suffix={profile.bodyFatPercent ? '%' : undefined} detail="Stored estimate" />
                    <MetricTile label="FAT MASS" value={fatMass ?? '--'} suffix={fatMass != null ? 'KG' : undefined} detail="Estimated fat mass" />
                  </div>
                </div>
              </SystemSurface>

              <div className="biometrics-grid biometrics-grid--split">
                <SystemSurface as="section" interactive={false} delay={0.1} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>Mass Breakdown</div>
                    <div className="biometrics-surface-copy">Lean share is only available when body fat is stored. Until then, the profile still tracks frame and BMI.</div>
                  </div>

                  <div className="biometrics-stack biometrics-stack--tight">
                    <DataBar label="LEAN MASS" value={leanMass ?? 0} total={profile.weightKg || 1} accent="linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.24))" detail={leanMass != null ? `${leanMass} KG` : 'Needs body fat input'} delay={0.12} />
                    <DataBar label="BODY FAT" value={bodyFatPercent} total={100} accent="linear-gradient(90deg, rgba(255,255,255,0.52), rgba(255,255,255,0.12))" detail={profile.bodyFatPercent != null ? `${profile.bodyFatPercent}%` : 'Not stored'} delay={0.14} />
                    <DataBar label="FRAME INDEX" value={bmi} total={40} accent="linear-gradient(90deg, rgba(255,255,255,0.68), rgba(255,255,255,0.16))" detail={`${bmi} BMI`} delay={0.16} />
                  </div>
                </SystemSurface>

                <SystemSurface as="section" interactive={false} delay={0.14} className="biometrics-surface">
                  <div className="biometrics-surface-heading">
                    <div className={typeStyles.label}>System Readout</div>
                    <div className="biometrics-surface-copy">The body page now summarizes profile context instead of scattering isolated metrics.</div>
                  </div>

                  <div className="biometrics-insight-list">
                    <div className="goal-insight-line">
                      Current target is set to {getGoalLabel(profile.goalType).toLowerCase()} with a daily intake of {calorieTarget} kcal.
                    </div>
                    <div className="goal-insight-line">
                      Activity tier is {getActivityLabel(profile.activityLevel).toLowerCase()}, which drives the TDEE estimate at {tdee} kcal.
                    </div>
                    <div className="goal-insight-line">
                      {weeklyDelta != null ? `Weight moved ${formatDelta(weeklyDelta).toLowerCase()} over the last tracked week.` : 'Weekly movement is not available yet. Add more weigh-ins to unlock the trend.'}
                    </div>
                    <div className="goal-insight-line">
                      {profile.bodyFatPercent != null && leanMass != null ? `Estimated lean mass is ${leanMass} kg with an estimated fat mass of ${fatMass} kg.` : 'Body fat is optional, but entering it unlocks lean mass and fat mass estimates.'}
                    </div>
                  </div>
                </SystemSurface>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
