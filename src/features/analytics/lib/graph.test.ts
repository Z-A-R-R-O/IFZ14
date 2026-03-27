import { describe, expect, it } from 'vitest';
import { buildLinePath, buildPoints, buildTimelineSummary, clamp } from './graph';
import { formatSignalLabel } from './signals';

describe('analytics graph helpers', () => {
  it('clamps values within bounds', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(6, 0, 10)).toBe(6);
  });

  it('builds SVG line paths and point sets', () => {
    const path = buildLinePath([10, 20, 30], 100, 50, 10);
    const points = buildPoints([10, 20, 30], 100, 50, 10);

    expect(path.startsWith('M ')).toBe(true);
    expect(path.includes('L')).toBe(true);
    expect(points).toHaveLength(3);
    expect(points[0].index).toBe(0);
    expect(points[2].index).toBe(2);
  });

  it('reports a rising timeline when both signals climb', () => {
    const summary = buildTimelineSummary(
      [
        { focus: 40, output: 42 },
        { focus: 48, output: 50 },
        { focus: 56, output: 58 },
        { focus: 64, output: 66 },
      ],
      null,
      formatSignalLabel
    );

    expect(summary).toContain('rising');
    expect(summary).toContain('Focus');
  });

  it('reports a slipping timeline when both signals fall', () => {
    const summary = buildTimelineSummary(
      [
        { focus: 80, output: 78 },
        { focus: 70, output: 68 },
        { focus: 60, output: 58 },
        { focus: 50, output: 48 },
      ],
      null,
      formatSignalLabel
    );

    expect(summary).toContain('slipping');
    expect(summary).toContain('Focus');
  });

  it('reports divergence when one signal pulls ahead', () => {
    const summary = buildTimelineSummary(
      [
        { focus: 40, output: 40 },
        { focus: 58, output: 42 },
        { focus: 66, output: 44 },
        { focus: 74, output: 46 },
      ],
      'stable',
      formatSignalLabel
    );

    expect(summary).toContain('moving ahead');
    expect(summary).toContain('Focus');
    expect(summary).toContain('Output');
  });

  it('falls back to steady copy when movement stays tight', () => {
    const summary = buildTimelineSummary(
      [
        { focus: 50, output: 52 },
        { focus: 52, output: 53 },
        { focus: 51, output: 54 },
        { focus: 53, output: 55 },
      ],
      'stable',
      formatSignalLabel
    );

    expect(summary).toContain('steady');
  });
});
