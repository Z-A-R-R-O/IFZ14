import { useEffect, useMemo } from 'react';
import type { DailyEntry } from '../../../types';
import { useDailyStore } from '../../../stores/dailyStore';
import { useTaskStore } from '../../../stores/taskStore';
import { useAnalyticsStore } from '../../../stores/analyticsStore';
import {
  analyzeFailures,
  analyzeWeeklyPerformance,
  buildCausalChains,
  detectCausation,
  predictOutcome,
} from '../../../engines/analyticsEngine';
import { generateInsights } from '../../../engines/insightEngine';
import { calculateScore } from '../../../engines/scoreEngine';
import { buildLinePath, buildPoints, buildTimelineSummary, clamp } from '../lib/graph';
import {
  buildPatternMemory,
  formatSignalLabel,
  getFocusSignal,
  getOutputSignal,
  getRiskState,
  getTrendState,
} from '../lib/signals';

export function useAnalyticsModel(hoveredPointIndex: number | null) {
  const entries = useDailyStore((state) => state.entries);
  const todayEntry = useDailyStore((state) => state.getTodayEntry());
  const tasks = useTaskStore((state) => state.tasks);
  const logPrediction = useAnalyticsStore((state) => state.logPrediction);
  const getAdjustedConfidence = useAnalyticsStore((state) => state.getAdjustedConfidence);

  const allEntries = useMemo(
    () =>
      (Object.values(entries) as DailyEntry[])
        .filter(entry => entry.completed)
        .sort((left, right) => left.date.localeCompare(right.date)),
    [entries]
  );

  const insights = useMemo(
    () => detectCausation(allEntries, { confidenceAdjuster: getAdjustedConfidence }),
    [allEntries, getAdjustedConfidence]
  );
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
  const timelineSummary = useMemo(
    () => buildTimelineSummary(graphSeries, weeklyAnalysis?.trend ?? null, formatSignalLabel),
    [graphSeries, weeklyAnalysis]
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

  return {
    causationRows,
    focusPath,
    focusPoints,
    graphHeight,
    graphPadding,
    graphSeries,
    graphWidth,
    hoveredGraphPoint,
    outputPath,
    outputPoints,
    patternMemory,
    prediction,
    predictionStatements,
    primarySignal,
    riskState,
    systemInsights,
    timelineSummary,
    trendState,
    weeklyAnalysis,
  };
}
