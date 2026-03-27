import { describe, expect, it } from 'vitest';
import { buildReportsModel } from './reportModel';
import { createEmptyEntry, type DailyEntry, type Task } from '../../types';

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

describe('buildReportsModel', () => {
  it('keeps baseline gating data for fewer than three completed days', () => {
    const entries = [
      makeEntry('2026-03-01'),
      makeEntry('2026-03-02'),
    ];

    const report = buildReportsModel({ entries, goals: [], tasks: [] });

    expect(report.collectedDays).toBe(2);
    expect(report.baselineDays).toBe(3);
    expect(report.archiveTimeline).toHaveLength(2);
  });

  it('builds time distribution using deep, light, and idle buckets', () => {
    const entries = [
      makeEntry('2026-03-01'),
      makeEntry('2026-03-02'),
      makeEntry('2026-03-03'),
      makeEntry('2026-03-04'),
      makeEntry('2026-03-05'),
      makeEntry('2026-03-06'),
      makeEntry('2026-03-07'),
    ];

    const tasks = [
      makeTask('t1', '2026-03-01T08:00:00.000Z', {
        completedAt: '2026-03-01T09:00:00.000Z',
        completedTime: 45,
        completed: true,
        status: 'done',
        energyType: 'light',
      }),
      makeTask('t2', '2026-03-02T08:00:00.000Z', {
        completedAt: '2026-03-02T10:00:00.000Z',
        estimatedTime: 30,
        completed: true,
        status: 'done',
        energyType: 'light',
      }),
    ];

    const report = buildReportsModel({ entries, goals: [], tasks });

    expect(report.timeDistribution).toHaveLength(3);
    expect(report.timeDistribution[0].label).toBe('DEEP WORK');
    expect(report.timeDistribution[0].value).toBe(840);
    expect(report.timeDistribution[1].label).toBe('LIGHT WORK');
    expect(report.timeDistribution[1].value).toBe(75);
    expect(report.timeDistribution[2].label).toBe('IDLE');
    expect(report.totalTrackedMinutes).toBeGreaterThan(report.timeDistribution[0].value);
  });

  it('calculates completion rate and produces archive summary rows from recent data', () => {
    const entries = [
      makeEntry('2026-03-01', { efficiencyRating: 5 }),
      makeEntry('2026-03-02', { efficiencyRating: 4 }),
      makeEntry('2026-03-03', { efficiencyRating: 8 }),
      makeEntry('2026-03-04', { efficiencyRating: 7 }),
      makeEntry('2026-03-05', { efficiencyRating: 6 }),
      makeEntry('2026-03-06', { efficiencyRating: 9 }),
      makeEntry('2026-03-07', { efficiencyRating: 3 }),
    ];

    const tasks = [
      makeTask('t1', '2026-03-01T08:00:00.000Z', {
        completedAt: '2026-03-01T09:00:00.000Z',
        completed: true,
        status: 'done',
      }),
      makeTask('t2', '2026-03-02T08:00:00.000Z', {
        completedAt: '2026-03-02T09:00:00.000Z',
        completed: true,
        status: 'done',
      }),
      makeTask('t3', '2026-03-03T08:00:00.000Z'),
    ];

    const report = buildReportsModel({ entries, goals: [], tasks });

    expect(report.completionRate).toBe(67);
    expect(report.memoryLines.length).toBeGreaterThan(0);
    expect(report.patternMemory.length).toBeGreaterThan(0);
    expect(report.archiveTimeline).toHaveLength(7);
  });
});
