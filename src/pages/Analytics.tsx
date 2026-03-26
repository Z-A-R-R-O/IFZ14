import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { DailyEntry, CausalInsight } from '../types';
import AnimatedMetric from '../components/AnimatedMetric';
import { useDailyStore } from '../stores/dailyStore';
import { useTaskStore } from '../stores/taskStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import {
  detectCausation,
  analyzeFailures,
  predictOutcome,
  buildCausalChains,
  analyzeWeeklyPerformance,
} from '../engines/analyticsEngine';
import { generateInsights } from '../engines/insightEngine';
import { calculateScore } from '../engines/scoreEngine';
import { dashboardSequence, motionTiming } from '../motion';
import { type as typeStyles } from '../typography';
import SystemSurface from '../ui/components/SystemSurface';
import { uiMotion } from '../ui/motion/presets';

const motionConfig = uiMotion;

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSignalLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFocusSignal(entry: DailyEntry) {
  const dynamicSessions = entry.dynamic_values?.dwSessions ?? [];
  if (dynamicSessions.length > 0) {
    return Math.round(avg(dynamicSessions.map((session: any) => session.focus || session.quality || 0)));
  }

  const legacyFocus = [entry.dw1FocusQuality, entry.dw2FocusQuality].filter(
    (value): value is number => typeof value === 'number' && value > 0
  );
  if (legacyFocus.length > 0) return Math.round(avg(legacyFocus) * 10);
  if ((entry.deepWorkScore || 0) > 0) return Math.round((entry.deepWorkScore || 0) * 10);
  return 0;
}

function getOutputSignal(entry: DailyEntry) {
  if ((entry.outputScore || 0) > 0) return Math.round((entry.outputScore || 0) * 10);
  if ((entry.productionScore || 0) > 0) return Math.round((entry.productionScore || 0) * 10);
  return calculateScore(entry).score;
}

function buildLinePath(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return '';
  const maxValue = Math.max(...values, 100);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  return values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildPoints(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return [];
  const maxValue = Math.max(...values, 100);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  return values.map((value, index) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1),
    y: height - padding - ((value - minValue) / range) * (height - padding * 2),
    value,
    index,
  }));
}

function getTrendState(
  weeklyTrend: 'improving' | 'declining' | 'stable' | null,
  predictionTrend: 'RISING' | 'STABLE' | 'FALLING'
) {
  if (weeklyTrend === 'improving' || predictionTrend === 'RISING') {
    return { label: 'UP', note: 'Momentum strengthening across recent sessions.' };
  }
  if (weeklyTrend === 'declining' || predictionTrend === 'FALLING') {
    return { label: 'DECLINE', note: 'Performance drift detected. Baseline correction needed.' };
  }
  return { label: 'STABLE', note: 'System output is holding steady.' };
}

function getRiskState(verdict: string | null, predictionTrend: 'RISING' | 'STABLE' | 'FALLING', latestScore: number) {
  if (verdict === 'UNDERPERFORMED' || verdict === 'DECLINING' || predictionTrend === 'FALLING' || latestScore < 55) {
    return { label: 'RISK ELEVATED', tone: 'rgba(255,150,150,0.88)' };
  }
  if (verdict === 'UNSTABLE') {
    return { label: 'WATCH VOLATILITY', tone: 'rgba(255,212,138,0.88)' };
  }
  return { label: 'STABILITY HIGH', tone: 'rgba(166,228,188,0.88)' };
}

function buildPatternMemory(entries: DailyEntry[], insights: CausalInsight[], weeklyIssue: string | null, generated: string[]) {
  const memory: string[] = [];

  const laggedSleep = insights.find(insight => insight.cause === 'sleep' && insight.lag === 1);
  if (laggedSleep) {
    memory.push(`Low sleep -> ${formatSignalLabel(laggedSleep.effect)} shifts after ${laggedSleep.lag + 1} days`);
  }

  const sleepAvg = avg(entries.slice(-7).map(entry => entry.totalSleepHours || 0));
  const deepWorkDays = entries.filter(entry => getFocusSignal(entry) >= 70);
  if (sleepAvg > 0 && deepWorkDays.length >= 2) {
    memory.push(`Deep work holds better when sleep stays above ${sleepAvg.toFixed(1)}h`);
  }

  if (weeklyIssue) {
    memory.push(`${weeklyIssue} has become the dominant weekly drag`);
  }

  generated.forEach(text => {
    if (memory.length < 3) memory.push(text);
  });

  return memory.slice(0, 3);
}

export default function Analytics() {
  const entries = useDailyStore((state) => state.entries);
  const todayEntry = useDailyStore((state) => state.getTodayEntry());
  const tasks = useTaskStore((state) => state.tasks);
  const logPrediction = useAnalyticsStore((state) => state.logPrediction);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const allEntries = useMemo(
    () =>
      (Object.values(entries) as DailyEntry[])
        .filter(entry => entry.completed)
        .sort((left, right) => left.date.localeCompare(right.date)),
    [entries]
  );

  const insights = useMemo(() => detectCausation(allEntries), [allEntries]);
  const failures = useMemo(() => analyzeFailures(allEntries).slice(0, 3), [allEntries]);
  const prediction = useMemo(() => predictOutcome(todayEntry, tasks), [todayEntry, tasks]);
  const causalChains = useMemo(() => buildCausalChains(insights), [insights]);
  const generatedInsights = useMemo(() => generateInsights(allEntries), [allEntries]);

  const currentWeek = useMemo(() => allEntries.slice(-7), [allEntries]);
  const previousWeek = useMemo(() => allEntries.slice(-14, -7), [allEntries]);
  const weeklyAnalysis = useMemo(() => {
    if (currentWeek.length < 3) return null;
    return analyzeWeeklyPerformance(currentWeek, previousWeek, failures);
  }, [currentWeek, previousWeek, failures]);

  const latestScore = todayEntry.completed ? calculateScore(todayEntry).score : prediction.expectedScore;
  const primarySignal = latestScore || prediction.expectedScore || 0;
  const trendState = getTrendState(weeklyAnalysis?.trend ?? null, prediction.trend);
  const riskState = getRiskState(weeklyAnalysis?.verdict ?? null, prediction.trend, latestScore);

  const graphEntries = useMemo(() => allEntries.slice(-10), [allEntries]);
  const graphSeries = useMemo(
    () =>
      graphEntries.map(entry => ({
        date: entry.date.slice(5),
        focus: clamp(getFocusSignal(entry), 0, 100),
        output: clamp(getOutputSignal(entry), 0, 100),
      })),
    [graphEntries]
  );

  const graphWidth = 880;
  const graphHeight = 280;
  const graphPadding = 28;
  const focusPath = buildLinePath(graphSeries.map(point => point.focus), graphWidth, graphHeight, graphPadding);
  const outputPath = buildLinePath(graphSeries.map(point => point.output), graphWidth, graphHeight, graphPadding);
  const focusPoints = buildPoints(graphSeries.map(point => point.focus), graphWidth, graphHeight, graphPadding);
  const outputPoints = buildPoints(graphSeries.map(point => point.output), graphWidth, graphHeight, graphPadding);

  const causationRows = useMemo(() => {
    if (causalChains.length === 0) return [];

    return causalChains.map(chain =>
      chain.map((node, index) => {
        const next = chain[index + 1];
        const relation = next
          ? insights.find(insight => insight.cause === node && insight.effect === next)
          : undefined;
        return { node, relation };
      })
    );
  }, [causalChains, insights]);

  const patternMemory = useMemo(
    () =>
      buildPatternMemory(
        allEntries,
        insights,
        weeklyAnalysis?.primaryIssue ?? null,
        generatedInsights.map(insight => insight.text)
      ),
    [allEntries, insights, weeklyAnalysis, generatedInsights]
  );

  const latestEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : undefined;
  const predictionDelta = Math.round(prediction.expectedScore - (latestEntry ? calculateScore(latestEntry).score : 0));
  const predictionStatements = useMemo(() => {
    const statements: string[] = [];

    statements.push(
      `If current trend continues -> Output ${predictionDelta >= 0 ? '+' : ''}${predictionDelta}% against recent baseline`
    );

    if ((todayEntry.totalSleepHours || 0) < 6.5 || (todayEntry.efficiencyRating ?? todayEntry.energyLevel ?? 0) < 5) {
      statements.push('Recovery possible in 3 days if sleep stabilizes and load drops.');
    } else if (prediction.trend === 'RISING') {
      statements.push('Momentum can compound over the next 2 days if execution remains clean.');
    } else {
      statements.push('Stability can be preserved over the next 3 days if baseline routines hold.');
    }

    return statements;
  }, [predictionDelta, prediction.trend, todayEntry.efficiencyRating, todayEntry.energyLevel, todayEntry.totalSleepHours]);

  const systemInsights = useMemo(() => {
    const lines = generatedInsights.map(insight => insight.text);
    if (weeklyAnalysis?.mode) lines.unshift(`System mode bias: ${weeklyAnalysis.mode}`);
    return lines.slice(0, 5);
  }, [generatedInsights, weeklyAnalysis]);

  useEffect(() => {
    if (prediction.expectedScore > 0 && todayEntry.date) {
      logPrediction('DAILY_SCORE', 0.8, prediction.expectedScore, todayEntry.date);
      insights.forEach(insight => {
        const key = `${insight.cause}->${insight.effect}|lag${insight.lag}`;
        logPrediction(key, insight.confidence, insight.impact, todayEntry.date);
      });
    }
  }, [prediction.expectedScore, todayEntry.date, logPrediction, insights]);

  const hoveredGraphPoint = hoveredPointIndex === null ? null : graphSeries[hoveredPointIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionTiming.slow}
      style={{ paddingBottom: '60px' }}
    >
      <div style={{ marginBottom: '42px' }}>
        <motion.p
          className={typeStyles.identityLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...motionTiming.fast, delay: dashboardSequence.heading }}
          style={{ marginBottom: '12px' }}
        >
          SYSTEM ONLINE
        </motion.p>
        <motion.h1
          className={typeStyles.hero}
          initial={{ opacity: 0, y: 12, letterSpacing: '0.14em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.09em' }}
          transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.08 }}
          style={{ marginBottom: '10px' }}
        >
          ANALYTICS MODE
        </motion.h1>
        <motion.p
          className="body"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.14 }}
          style={{ color: 'rgba(255,255,255,0.66)' }}
        >
          Causation active. Patterns detected.
        </motion.p>
      </div>

      <SystemSurface
        as="section"
        variant="elevated"
        delay={dashboardSequence.score}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
      
        <div>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            SYSTEM TREND
          </div>
          <div className="heading-sm" style={{ fontSize: '22px', color: 'rgba(255,255,255,0.94)', marginBottom: '10px' }}>
            {trendState.label}
          </div>
          <div className="body" style={{ color: 'rgba(255,255,255,0.54)' }}>
            {trendState.note}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            PRIMARY METRIC SIGNAL
          </div>
          <div className="score-number" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            <AnimatedMetric value={primarySignal} />
          </div>
          <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.44)' }}>
            SYSTEM SCORE
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            RISK / STABILITY LEVEL
          </div>
          <div className="heading-sm" style={{ fontSize: '22px', color: riskState.tone, marginBottom: '10px' }}>
            {riskState.label}
          </div>
          <div className="body" style={{ color: 'rgba(255,255,255,0.54)' }}>
            {weeklyAnalysis?.primaryIssue ? `${weeklyAnalysis.primaryIssue} remains the dominant pressure.` : 'No critical fault path detected.'}
          </div>
        </div>
      </SystemSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <SystemSurface as="section" variant="elevated" delay={dashboardSequence.cards}>
          <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
            CAUSATION SIGNAL
          </div>
          <div className="body" style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.56)' }}>
            Detected drivers of performance change
          </div>

          {causationRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {causationRows.map((chain, chainIndex) => (
                <motion.div
                  key={`chain-${chainIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionConfig.smooth, delay: dashboardSequence.cards + 0.06 + chainIndex * 0.06 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {chain.map((row, index) => (
                    <motion.div
                      key={`${row.node}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...motionConfig.smooth, delay: dashboardSequence.cards + 0.1 + index * 0.05 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                    >
                      <motion.div
                        whileHover={{ opacity: 1, backgroundColor: `rgba(255,255,255,${0.04 + index * 0.02})` }}
                        transition={motionConfig.fast}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: `rgba(255,255,255,${0.02 + index * 0.02})`,
                          opacity: 0.62 + index * 0.12,
                        }}
                      >
                        <span className="font-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
                          {formatSignalLabel(row.node)}
                        </span>
                        <span className="font-mono" style={{ fontSize: '12px', letterSpacing: '0.12em', color: row.relation?.impact && row.relation.impact < 0 ? 'rgba(255,170,170,0.9)' : 'rgba(180,230,198,0.9)' }}>
                          {row.relation ? `${row.relation.impact > 0 ? '+' : ''}${row.relation.impact}%` : 'LOCKED'}
                        </span>
                      </motion.div>
                      {row.relation && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ ...motionConfig.fast, delay: dashboardSequence.cards + 0.12 + index * 0.05 }}
                          style={{ display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', fontSize: '11px' }}
                        >
                          {'-> '}
                          {formatSignalLabel(row.relation.effect)}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
              System is still learning. More completed days are needed before causal chains lock.
            </div>
          )}
        </SystemSurface>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SystemSurface as="section" variant="elevated" delay={dashboardSequence.cards + 0.08}>
            <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
              PATTERN MEMORY
            </div>
            <div className="body" style={{ marginBottom: '18px', color: 'rgba(255,255,255,0.56)' }}>
              Time-linked behavior signatures
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patternMemory.length > 0 ? (
                patternMemory.map((line, index) => (
                  <motion.div
                    key={`pattern-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...motionConfig.smooth, delay: dashboardSequence.cards + 0.12 + index * 0.05 }}
                    whileHover={{ opacity: 1 }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.018)',
                      opacity: 0.82,
                    }}
                  >
                    <span className="body" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      {line}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
                  Pattern memory will sharpen as the system accumulates more completed days.
                </div>
              )}
            </div>
          </SystemSurface>

          <SystemSurface as="section" variant="elevated" delay={dashboardSequence.cards + 0.16}>
            <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
              PREDICTED STATE
            </div>
            <div className="body" style={{ marginBottom: '18px', color: 'rgba(255,255,255,0.56)' }}>
              Forward signal from current conditions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)' }}>
                <AnimatedMetric value={prediction.expectedScore} />
              </div>
              {predictionStatements.map((statement, index) => (
                <motion.div
                  key={`prediction-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionConfig.smooth, delay: dashboardSequence.cards + 0.18 + index * 0.05 }}
                  className="body"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  {statement}
                </motion.div>
              ))}
            </div>
          </SystemSurface>
        </div>
      </div>

      <SystemSurface as="section" variant="elevated" delay={dashboardSequence.hud} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '18px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
              METRIC TIMELINE
            </div>
            <div className="body" style={{ color: 'rgba(255,255,255,0.56)' }}>
              Focus and output over time
            </div>
          </div>
          {hoveredGraphPoint && (
            <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.72)' }}>
              {hoveredGraphPoint.date} | FOCUS {hoveredGraphPoint.focus} | OUTPUT {hoveredGraphPoint.output}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', minWidth: '720px', height: '280px', display: 'block' }}>
            {[0.25, 0.5, 0.75].map(level => (
              <line
                key={level}
                x1={graphPadding}
                x2={graphWidth - graphPadding}
                y1={graphHeight - graphPadding - level * (graphHeight - graphPadding * 2)}
                y2={graphHeight - graphPadding - level * (graphHeight - graphPadding * 2)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            ))}

            <motion.path
              d={focusPath}
              fill="none"
              stroke="rgba(170,225,196,0.92)"
              strokeWidth="2.4"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ ...motionTiming.slow, delay: dashboardSequence.hud + 0.08 }}
            />
            <motion.path
              d={outputPath}
              fill="none"
              stroke="rgba(255,255,255,0.82)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ ...motionTiming.slow, delay: dashboardSequence.hud + 0.14 }}
            />

            {focusPoints.map((point, index) => (
              <g key={`focus-${index}`} onMouseEnter={() => setHoveredPointIndex(index)} onMouseLeave={() => setHoveredPointIndex(null)}>
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPointIndex === index ? 4 : 2.8}
                  fill="rgba(170,225,196,0.98)"
                  animate={{ opacity: hoveredPointIndex === null || hoveredPointIndex === index ? 1 : 0.58 }}
                  transition={motionConfig.fast}
                />
              </g>
            ))}
            {outputPoints.map((point, index) => (
              <g key={`output-${index}`} onMouseEnter={() => setHoveredPointIndex(index)} onMouseLeave={() => setHoveredPointIndex(null)}>
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPointIndex === index ? 4 : 2.6}
                  fill="rgba(255,255,255,0.92)"
                  animate={{ opacity: hoveredPointIndex === null || hoveredPointIndex === index ? 1 : 0.58 }}
                  transition={motionConfig.fast}
                />
              </g>
            ))}

            {graphSeries.map((point, index) => {
              const x = graphPadding + (index * (graphWidth - graphPadding * 2)) / Math.max(graphSeries.length - 1, 1);
              return (
                <text
                  key={`label-${point.date}`}
                  x={x}
                  y={graphHeight - 6}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.34)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em' }}
                >
                  {point.date}
                </text>
              );
            })}
          </svg>
        </div>
      </SystemSurface>

      <SystemSurface as="section" variant="elevated" delay={dashboardSequence.footer}>
        <div className={typeStyles.label} style={{ marginBottom: '18px' }}>
          SYSTEM INSIGHTS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {systemInsights.length > 0 ? (
            systemInsights.map((insight, index) => (
              <motion.div
                key={`insight-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...motionConfig.smooth, delay: dashboardSequence.footer + 0.04 + index * 0.04 }}
                whileHover={{ opacity: 1 }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.018)',
                  opacity: 0.84,
                }}
              >
                <span className="body" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {insight}
                </span>
              </motion.div>
            ))
          ) : (
            <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
              System insights will populate after more completed logs are available.
            </div>
          )}
        </div>
      </SystemSurface>
    </motion.div>
  );
}
