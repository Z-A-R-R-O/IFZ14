import { describe, expect, it } from 'vitest';
import {
  analyzeFailures,
  analyzeWeeklyPerformance,
  detectCausation,
  generateWeeklyReport,
  predictOutcome,
} from './analyticsEngine';
import { buildReportsModel } from '../lib/reports/reportModel';
import { createEmptyEntry, type DailyEntry, type Task } from '../types';

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
    goalProgress: 6,
    dynamic_values: {
      dwSessions: [
        {
          id: `dw-${date}`,
          duration: 120,
          focus: 80,
          status: 'done',
        },
      ],
    },
    ...overrides,
  };
}

function makeTask(
  id: string,
  createdAt: string,
  overrides: Partial<Task> = {}
): Task {
  return {
    id,
    title: `Task ${id}`,
    completed: false,
    status: 'pending',
    priority: 'MED',
    estimatedTime: 30,
    completedTime: 0,
    energyType: 'light',
    createdAt,
    ...overrides,
  };
}

describe('generateWeeklyReport', () => {
  it('returns the insufficient-data message before seven completed days', () => {
    const entries = [makeEntry('2026-03-01'), makeEntry('2026-03-02'), makeEntry('2026-03-03')];

    const doc = generateWeeklyReport(entries, [], []);

    expect(doc).toContain('INSUFFICIENT DATA');
    expect(doc).toContain('Log at least 7 days');
  });

  it('uses the shared report model values in the exported report', () => {
    const entries = [
      makeEntry('2026-03-01', { efficiencyRating: 6 }),
      makeEntry('2026-03-02', { efficiencyRating: 5 }),
      makeEntry('2026-03-03', { efficiencyRating: 8 }),
      makeEntry('2026-03-04', { efficiencyRating: 7 }),
      makeEntry('2026-03-05', { efficiencyRating: 6 }),
      makeEntry('2026-03-06', { efficiencyRating: 9 }),
      makeEntry('2026-03-07', { efficiencyRating: 8 }),
    ];

    const tasks = [
      makeTask('t1', '2026-03-01T08:00:00.000Z', {
        completedAt: '2026-03-01T09:00:00.000Z',
        completedTime: 45,
        completed: true,
        status: 'done',
      }),
    ];

    const report = buildReportsModel({ entries, goals: [], tasks });
    const doc = generateWeeklyReport(entries, [], tasks);

    expect(doc).toContain(`Status: ${report.weekly.verdict}`);
    expect(doc).toContain(`Score:  ${report.averageScore} (${report.weekly.trend})`);
    expect(doc).toContain(`Mode:   ${report.weekly.mode}`);
    expect(doc).toContain(`Deep Work: ${report.deepHours}h`);
  });
});

describe('analytics engine derivation', () => {
  it('returns limited causation insight for small datasets with positive deep-work correlation', () => {
    const entries = [
      makeEntry('2026-03-01', {
        dynamic_values: { dwSessions: [{ id: 'a', duration: 60, focus: 50, status: 'done' }] },
        outputScore: 4,
      }),
      makeEntry('2026-03-02', {
        dynamic_values: { dwSessions: [{ id: 'b', duration: 120, focus: 90, status: 'done' }] },
        outputScore: 9,
      }),
    ];

    const insights = detectCausation(entries);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].cause).toBe('deepWork');
    expect(insights[0].effect).toBe('score');
  });

  it('detects repeated distraction as a top failure mode', () => {
    const entries = [
      makeEntry('2026-03-01', {
        dw1Interruptions: 2,
        dynamic_values: { reflection: { deepWorkFailure: 'DISTRACTION' } },
        outputScore: 2,
      } as Partial<DailyEntry>),
      makeEntry('2026-03-02', {
        dw1Interruptions: 2,
        dynamic_values: { reflection: { deepWorkFailure: 'DISTRACTION' } },
        outputScore: 3,
      } as Partial<DailyEntry>),
      makeEntry('2026-03-03', {
        dw1Interruptions: 2,
        dynamic_values: { reflection: { deepWorkFailure: 'DISTRACTION' } },
        outputScore: 2,
      } as Partial<DailyEntry>),
    ];

    const failures = analyzeFailures(entries);

    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].topFailure).toContain('DISTRACTION');
    expect(failures[0].frequency).toBeGreaterThan(0.5);
  });

  it('applies the current heuristic thresholds for a planned deep-work day', () => {
    const prediction = predictOutcome(
      {
        date: '2026-03-07',
        efficiencyRating: 9,
        totalSleepHours: 8,
      },
      [
        makeTask('deep-1', '2026-03-07T08:00:00.000Z', {
          energyType: 'deep',
          estimatedTime: 120,
          priority: 'HIGH',
        }),
      ]
    );

    expect(prediction.expectedScore).toBeGreaterThanOrEqual(50);
    expect(prediction.trend).toBe('FALLING');
  });

  it('marks an underperforming recovery week when sleep and scores collapse', () => {
    const currentWeek = Array.from({ length: 7 }, (_, index) =>
      makeEntry(`2026-03-0${index + 1}`, {
        totalSleepHours: 5,
        efficiencyRating: 4,
        outputScore: 2,
        goalProgress: 2,
        dynamic_values: { dwSessions: [{ id: `c-${index}`, duration: 30, focus: 35, status: 'done' }] },
      })
    );
    const previousWeek = Array.from({ length: 7 }, (_, index) =>
      makeEntry(`2026-02-2${index + 1}`, {
        totalSleepHours: 7.5,
        efficiencyRating: 7,
        outputScore: 7,
        goalProgress: 7,
        dynamic_values: { dwSessions: [{ id: `p-${index}`, duration: 120, focus: 80, status: 'done' }] },
      })
    );

    const failures = analyzeFailures(
      currentWeek.map(entry => ({
        ...entry,
        dynamic_values: { reflection: { deepWorkFailure: 'OVERLOAD' } },
      } as DailyEntry))
    );
    const weekly = analyzeWeeklyPerformance(currentWeek, previousWeek, failures);

    expect(weekly.verdict).toBe('UNDERPERFORMED');
    expect(weekly.mode).toBe('RECOVERY');
    expect(['declining', 'stable']).toContain(weekly.trend);
  });
});
