import { describe, expect, it } from 'vitest';
import { createEmptyEntry, type CausalInsight, type DailyEntry } from '../../../types';
import { buildPatternMemory, formatSignalLabel, getFocusSignal, getOutputSignal, getRiskState, getTrendState } from './signals';

function makeEntry(
  date: string,
  overrides: Partial<DailyEntry> = {}
): DailyEntry {
  return {
    ...createEmptyEntry(date),
    completed: true,
    totalSleepHours: 7,
    efficiencyRating: 7,
    outputScore: 7,
    productionScore: 7,
    deepWorkScore: 7,
    dynamic_values: {
      dwSessions: [
        {
          id: `dw-${date}`,
          duration: 90,
          focus: 80,
          status: 'done',
        },
      ],
    },
    ...overrides,
  };
}

describe('analytics signal helpers', () => {
  it('formats signal labels for display', () => {
    expect(formatSignalLabel('deepWork')).toBe('Deep Work');
    expect(formatSignalLabel('sleep_score')).toBe('Sleep Score');
  });

  it('extracts focus and output signals from entries', () => {
    const entry = makeEntry('2026-03-01');

    expect(getFocusSignal(entry)).toBe(80);
    expect(getOutputSignal(entry)).toBe(70);
  });

  it('builds trend and risk states from weekly and prediction inputs', () => {
    expect(getTrendState('improving', 'STABLE').label).toBe('UP');
    expect(getTrendState('stable', 'FALLING').label).toBe('DECLINE');
    expect(getRiskState('UNSTABLE', 'STABLE', 70).label).toBe('WATCH VOLATILITY');
    expect(getRiskState('OPTIMAL', 'STABLE', 80).label).toBe('STABILITY HIGH');
  });

  it('builds pattern memory from insights, weekly drag, and generated lines', () => {
    const entries = [
      makeEntry('2026-03-01'),
      makeEntry('2026-03-02'),
      makeEntry('2026-03-03'),
      makeEntry('2026-03-04'),
      makeEntry('2026-03-05'),
      makeEntry('2026-03-06'),
      makeEntry('2026-03-07'),
    ];
    const insights: CausalInsight[] = [
      {
        cause: 'sleep',
        effect: 'deepWork',
        lag: 1,
        impact: 12,
        confidence: 0.7,
        type: 'boost',
      },
    ];

    const memory = buildPatternMemory(entries, insights, 'Distraction', ['Generated fallback line']);

    expect(memory.length).toBeGreaterThan(0);
    expect(memory.join(' ')).toContain('Low sleep');
    expect(memory.join(' ')).toContain('Distraction');
  });
});
