import { useMemo } from 'react';
import { motion } from 'framer-motion';
import AnimatedMetric from '../components/AnimatedMetric';
import { calculateScore } from '../engines/scoreEngine';
import { avg, analyzeFailures, analyzeWeeklyPerformance, calculateGoalImpact } from '../engines/analyticsEngine';
import { generateInsights } from '../engines/insightEngine';
import { detectPattern } from '../engines/patternEngine';
import { calculateStreaks } from '../engines/streakEngine';
import { useDailyStore } from '../stores/dailyStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { type as typeStyles } from '../typography';
import type { DailyEntry } from '../types';
import SystemSurface from '../ui/components/SystemSurface';
import { fadeInUp } from '../ui/motion/presets';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDeepMinutes(entry: DailyEntry) {
  if (entry.dynamic_values?.dwSessions?.length) {
    return entry.dynamic_values.dwSessions.reduce((sum: number, session: any) => sum + (session.duration || 60), 0);
  }

  const qualities = [entry.dw1FocusQuality || 0, entry.dw2FocusQuality || 0].filter(Boolean);
  return qualities.reduce((sum, quality) => sum + quality * 12, 0);
}

function getFocusSignal(entry: DailyEntry) {
  if (entry.dynamic_values?.dwSessions?.length) {
    return avg(entry.dynamic_values.dwSessions.map((session: any) => session.focus || 0));
  }

  const qualities = [entry.dw1FocusQuality || 0, entry.dw2FocusQuality || 0].filter(Boolean);
  return qualities.length > 0 ? avg(qualities) * 10 : 0;
}

function formatTrend(trend: ReturnType<typeof detectPattern>['trend']) {
  if (trend === 'RISING') return 'IMPROVING';
  if (trend === 'DECLINING') return 'DECLINING';
  if (trend === 'VOLATILE') return 'VOLATILE';
  return 'STABLE';
}

function formatArchiveDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function buildMemory(entries: DailyEntry[], streaks: ReturnType<typeof calculateStreaks>) {
  if (entries.length === 0) return [];

  const scored = entries.map(entry => ({ entry, score: calculateScore(entry).score }));
  const highest = [...scored].sort((left, right) => right.score - left.score)[0];
  const lowestEnergy = [...entries].filter(entry => entry.energyLevel !== undefined).sort((left, right) => (left.energyLevel || 0) - (right.energyLevel || 0))[0];
  const deepest = [...entries].sort((left, right) => getDeepMinutes(right) - getDeepMinutes(left))[0];

  const lines = [
    highest ? `Highest output day recorded on ${formatArchiveDate(highest.entry.date)} at ${highest.score}.` : '',
    deepest ? `Longest deep work day logged on ${formatArchiveDate(deepest.date)} with ${Math.round(getDeepMinutes(deepest) / 60 * 10) / 10}h focused.` : '',
    lowestEnergy ? `Lowest energy period occurred on ${formatArchiveDate(lowestEnergy.date)} at ${lowestEnergy.energyLevel || 0}/10.` : '',
    streaks.highScore > 0 ? `Longest active high-performance streak is ${streaks.highScore} days.` : '',
  ];

  return lines.filter(Boolean).slice(0, 4);
}

export default function Reports() {
  const entries = useDailyStore(state => state.entries);
  const goals = useGoalStore(state => state.goals);
  const tasks = useTaskStore(state => state.tasks);

  const allEntries = useMemo(
    () =>
      (Object.values(entries) as DailyEntry[])
        .filter(entry => entry.completed)
        .sort((left, right) => left.date.localeCompare(right.date)),
    [entries]
  );

  const collectedDays = allEntries.length;
  const baselineDays = 3;

  const recentWindow = allEntries.slice(-7);
  const previousWindow = allEntries.slice(-14, -7);
  const recentScores = recentWindow.map(entry => calculateScore(entry).score);
  const deepMinutes = recentWindow.map(getDeepMinutes);
  const focusSignals = recentWindow.map(getFocusSignal).filter(value => value > 0);
  const trend = detectPattern(allEntries);
  const streaks = calculateStreaks(allEntries);
  const insightLines = generateInsights(allEntries).map(insight => insight.text);
  const failures = analyzeFailures(recentWindow);
  const weekly = analyzeWeeklyPerformance(recentWindow, previousWindow, failures);
  const goalImpact = calculateGoalImpact(goals, tasks, recentWindow, previousWindow).slice(0, 4);

  const consistency = useMemo(() => {
    if (recentScores.length < 2) return collectedDays >= baselineDays ? 100 : 0;
    const diffs = recentScores.slice(1).map((score, index) => Math.abs(score - recentScores[index]));
    return clamp(Math.round(100 - avg(diffs) * 3.4), 0, 100);
  }, [collectedDays, recentScores]);

  const riskLabel = useMemo(() => {
    const criticalDays = recentScores.filter(score => score < 45).length;
    if (criticalDays >= 2 || trend.trend === 'DECLINING') return 'RISING';
    if (trend.trend === 'VOLATILE') return 'VARIABLE';
    return 'CONTROLLED';
  }, [recentScores, trend.trend]);

  const averageScore = recentScores.length > 0 ? Math.round(avg(recentScores)) : 0;
  const deepHours = Math.round((avg(deepMinutes) / 60) * 10) / 10;
  const lightMinutes = useMemo(() => {
    const recentDates = new Set(recentWindow.map(entry => entry.date));
    const recentTasks = tasks.filter(task => task.completedAt && recentDates.has(task.completedAt.slice(0, 10)));
    const light = recentTasks
      .filter(task => task.energyType !== 'deep')
      .reduce((sum, task) => sum + (task.completedTime || task.estimatedTime || 0), 0);
    return light;
  }, [recentWindow, tasks]);
  const activeMinutes = deepMinutes.reduce((sum, value) => sum + value, 0) + lightMinutes;
  const idleMinutes = clamp(recentWindow.length * 16 * 60 - activeMinutes, 0, recentWindow.length * 16 * 60);
  const totalTrackedMinutes = Math.max(activeMinutes + idleMinutes, 1);
  const timeDistribution = [
    { label: 'DEEP WORK', value: deepMinutes.reduce((sum, value) => sum + value, 0), accent: 'rgba(168, 219, 188, 0.88)' },
    { label: 'LIGHT WORK', value: lightMinutes, accent: 'rgba(255,255,255,0.82)' },
    { label: 'IDLE', value: idleMinutes, accent: 'rgba(255,255,255,0.38)' },
  ];

  const completionRate = useMemo(() => {
    const recentDates = new Set(recentWindow.map(entry => entry.date));
    const created = tasks.filter(task => recentDates.has(task.createdAt.slice(0, 10))).length;
    const completed = tasks.filter(task => task.completedAt && recentDates.has(task.completedAt.slice(0, 10))).length;
    if (created === 0 && completed === 0) return 0;
    return clamp(Math.round((completed / Math.max(created, completed, 1)) * 100), 0, 100);
  }, [recentWindow, tasks]);
  const efficiency = focusSignals.length > 0 ? Math.round(avg(focusSignals)) : 0;
  const focusStability = focusSignals.length > 1 ? clamp(Math.round(100 - avg(focusSignals.slice(1).map((value, index) => Math.abs(value - focusSignals[index])))), 0, 100) : 0;

  const patternMemory = [
    trend.description.replace(/[^\x20-\x7E]/g, ''),
    ...insightLines.slice(0, 3),
  ].filter(Boolean).slice(0, 4);

  const memoryLines = buildMemory(allEntries, streaks);
  const archiveTimeline = recentWindow.slice(-7).map(entry => {
    const { score, state } = calculateScore(entry);
    return {
      date: entry.date,
      score,
      state,
      energy: entry.energyLevel || 0,
      sleep: entry.totalSleepHours || 0,
      deepHours: Math.round((getDeepMinutes(entry) / 60) * 10) / 10,
    };
  });

  if (collectedDays < baselineDays) {
    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        <motion.section {...fadeInUp(0, 10)}>
          <div className={typeStyles.identityLabel} style={{ marginBottom: '10px' }}>SYSTEM ONLINE</div>
          <div className={typeStyles.hero}>REPORTS MODE</div>
          <div className="body" style={{ marginTop: '10px', maxWidth: '460px', opacity: 0.62 }}>
            Historical analysis. Long-term patterns preserved.
          </div>
        </motion.section>

        <SystemSurface as="section" interactive={false} delay={0.06} style={{ padding: '32px' }}>
          <div style={{ display: 'grid', gap: '18px', justifyItems: 'center', textAlign: 'center' }}>
            <div className={typeStyles.label} style={{ opacity: 0.72 }}>LOCKED ARCHIVE VIEW</div>
            <div className="score-number" style={{ color: 'rgba(255,255,255,0.94)' }}>INSUFFICIENT DATA</div>
            <div className="body" style={{ maxWidth: '360px', opacity: 0.58 }}>
              Log at least 3 days to unlock baseline reports.
            </div>
            <div style={{ width: '100%', maxWidth: '420px', display: 'grid', gap: '12px', marginTop: '8px' }}>
              <div className={typeStyles.label} style={{ opacity: 0.62, textAlign: 'left' }}>DATA ACCUMULATION</div>
              {[0, 1, 2].map(index => {
                const active = index < collectedDays;
                return (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '16px', alignItems: 'center' }}>
                    <span className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.46)' }}>
                      DAY {index + 1}
                    </span>
                    <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: active ? '100%' : '0%', height: '100%', background: active ? 'rgba(255,255,255,0.9)' : 'transparent' }} />
                    </div>
                  </div>
                );
              })}
              <div className="font-mono" style={{ fontSize: '12px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)', textAlign: 'left', marginTop: '4px' }}>
                {collectedDays} / {baselineDays} DAYS COLLECTED
              </div>
              <div className="body" style={{ fontSize: '13px', opacity: 0.5, textAlign: 'left' }}>
                System begins learning after the baseline threshold.
              </div>
            </div>
          </div>
        </SystemSurface>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '24px', paddingBottom: '120px' }}>
      <motion.section {...fadeInUp(0, 10)}>
        <div className={typeStyles.identityLabel} style={{ marginBottom: '10px' }}>SYSTEM ONLINE</div>
        <div className={typeStyles.hero}>REPORTS MODE</div>
        <div className="body" style={{ marginTop: '10px', maxWidth: '460px', opacity: 0.62 }}>
          Historical analysis. Long-term patterns preserved.
        </div>
      </motion.section>

      <SystemSurface as="section" interactive={false} delay={0.06} style={{ padding: '28px' }}>
        <div className="reports-hero-grid">
          <div style={{ display: 'grid', gap: '10px' }}>
            <div className={typeStyles.label} style={{ opacity: 0.72 }}>PERFORMANCE TREND</div>
            <div className="font-mono" style={{ fontSize: '24px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.92)' }}>{formatTrend(trend.trend)}</div>
            <div className="body" style={{ fontSize: '13px', opacity: 0.56 }}>{trend.description.replace(/[^\x20-\x7E]/g, '')}</div>
          </div>
          <div style={{ display: 'grid', gap: '10px', justifyItems: 'center', textAlign: 'center' }}>
            <div className={typeStyles.label} style={{ opacity: 0.72 }}>SYSTEM CONSISTENCY</div>
            <div className="score-number" style={{ color: 'rgba(255,255,255,0.94)' }}>
              <AnimatedMetric value={consistency} />
              <span style={{ fontSize: '0.42em', marginLeft: '4px', color: 'rgba(255,255,255,0.42)' }}>%</span>
            </div>
            <div className="body" style={{ fontSize: '13px', opacity: 0.56 }}>Recent score variance remains inside controlled range.</div>
          </div>
          <div style={{ display: 'grid', gap: '10px', justifyItems: 'end', textAlign: 'right' }}>
            <div className={typeStyles.label} style={{ opacity: 0.72 }}>RISK OVER TIME</div>
            <div className="font-mono" style={{ fontSize: '24px', letterSpacing: '0.14em', color: riskLabel === 'RISING' ? 'rgba(255, 132, 132, 0.92)' : 'rgba(255,255,255,0.82)' }}>
              {riskLabel}
            </div>
            <div className="body" style={{ fontSize: '13px', opacity: 0.56, maxWidth: '220px' }}>
              {weekly.primaryIssue ? `Primary pressure: ${weekly.primaryIssue}.` : 'No dominant historical failure pattern detected.'}
            </div>
          </div>
        </div>
      </SystemSurface>

      <div className="reports-layout-grid">
        <SystemSurface as="section" interactive={false} delay={0.1} style={{ padding: '28px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>TIME DISTRIBUTION</div>
          <div style={{ display: 'grid', gap: '14px' }}>
            {timeDistribution.map(segment => (
              <div key={segment.label} style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.58)' }}>{segment.label}</span>
                  <span className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.78)' }}>
                    {Math.round(segment.value / 60 * 10) / 10}H
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(segment.value / totalTrackedMinutes) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', borderRadius: '999px', background: segment.accent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SystemSurface>

        <SystemSurface as="section" interactive={false} delay={0.14} style={{ padding: '28px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>EXECUTION QUALITY</div>
          <div className="reports-metric-grid">
            {[
              { label: 'TASK COMPLETION', value: completionRate, suffix: '%', detail: 'Completion rate inside the current archive window.' },
              { label: 'DEEP WORK EFFICIENCY', value: efficiency, suffix: '%', detail: `${deepHours}h average focused output across the recent window.` },
              { label: 'FOCUS STABILITY', value: focusStability, suffix: '%', detail: 'Measures how stable focus quality remains from day to day.' },
            ].map(metric => (
              <div key={metric.label} style={{ display: 'grid', gap: '6px' }}>
                <div className={typeStyles.label} style={{ opacity: 0.62 }}>{metric.label}</div>
                <div className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)' }}>
                  <AnimatedMetric value={metric.value} />
                  <span style={{ fontSize: '0.5em', marginLeft: '3px', color: 'rgba(255,255,255,0.42)' }}>{metric.suffix}</span>
                </div>
                <div className="body" style={{ fontSize: '13px', opacity: 0.54 }}>{metric.detail}</div>
              </div>
            ))}
          </div>
        </SystemSurface>
      </div>

      <div className="reports-layout-grid">
        <SystemSurface as="section" interactive={false} delay={0.18} style={{ padding: '28px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>LONG TERM PATTERNS</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {patternMemory.map(line => (
              <div key={line} className="goal-insight-line">{line}</div>
            ))}
          </div>
        </SystemSurface>

        <SystemSurface as="section" interactive={false} delay={0.22} style={{ padding: '28px' }}>
          <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>GOAL CONTRIBUTION</div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {goalImpact.length > 0 ? goalImpact.map(goal => (
              <div key={goal.goalId} className="reports-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-primary)', fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>{goal.title}</div>
                  <div className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.42)' }}>
                    {goal.progressPercent}% LOCKED
                  </div>
                </div>
                <div className="font-mono" style={{ textAlign: 'right', fontSize: '11px', letterSpacing: '0.12em', color: goal.progressDelta > 0 ? 'rgba(168, 219, 188, 0.88)' : 'rgba(255,255,255,0.42)' }}>
                  +{goal.progressDelta}% | +{goal.contributionDelta}
                </div>
              </div>
            )) : (
              <div className="body" style={{ fontSize: '13px', opacity: 0.56 }}>No measurable goal movement in the current archive window.</div>
            )}
          </div>
        </SystemSurface>
      </div>

      <SystemSurface as="section" interactive={false} delay={0.26} style={{ padding: '28px' }}>
        <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>SYSTEM MEMORY</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {memoryLines.map(line => (
            <div key={line} className="goal-insight-line">{line}</div>
          ))}
        </div>
      </SystemSurface>

      <SystemSurface as="section" interactive={false} delay={0.3} style={{ padding: '28px' }}>
        <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>TIMELINE VIEW</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {archiveTimeline.map(item => (
            <div key={item.date} className="reports-row">
              <div style={{ display: 'grid', gap: '3px' }}>
                <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.68)' }}>
                  {formatArchiveDate(item.date)}
                </div>
                <div className="body" style={{ fontSize: '13px', opacity: 0.56 }}>
                  Score {item.score} | {item.deepHours}h deep | Sleep {item.sleep}h | Energy {item.energy}
                </div>
              </div>
              <div className="font-mono" style={{ textAlign: 'right', fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.74)' }}>
                {item.state}
              </div>
            </div>
          ))}
        </div>
      </SystemSurface>

      <SystemSurface as="section" interactive={false} delay={0.34} style={{ padding: '28px' }}>
        <div className={typeStyles.label} style={{ marginBottom: '16px', opacity: 0.76 }}>REPORT SUMMARY</div>
        <div className="body" style={{ fontSize: '13px', opacity: 0.62 }}>
          Current average score is {averageScore}. Weekly mode archived as {weekly.mode}. Historical failures detected: {failures.length > 0 ? failures[0].topFailure.toLowerCase() : 'none dominant'}.
        </div>
      </SystemSurface>
    </div>
  );
}
