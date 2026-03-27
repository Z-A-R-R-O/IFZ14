export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildLinePath(values: number[], width: number, height: number, padding: number) {
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

export function buildPoints(values: number[], width: number, height: number, padding: number) {
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

export function buildTimelineSummary(
  series: Array<{ focus: number; output: number }>,
  weeklyTrend: 'improving' | 'declining' | 'stable' | null,
  formatSignalLabel: (value: string) => string
) {
  if (series.length < 2) {
    return 'Timeline will sharpen as more completed days are logged.';
  }

  const recentWindow = series.slice(-4);
  const focusDelta = recentWindow[recentWindow.length - 1].focus - recentWindow[0].focus;
  const outputDelta = recentWindow[recentWindow.length - 1].output - recentWindow[0].output;
  const dominantSignal = Math.abs(focusDelta) >= Math.abs(outputDelta) ? 'focus' : 'output';

  if (weeklyTrend === 'improving' || (focusDelta >= 8 && outputDelta >= 8)) {
    return `Recent timeline is rising. ${formatSignalLabel(dominantSignal)} is leading the climb.`;
  }

  if (weeklyTrend === 'declining' || (focusDelta <= -8 && outputDelta <= -8)) {
    return `Recent timeline is slipping. ${formatSignalLabel(dominantSignal)} is driving the drop.`;
  }

  if (Math.abs(focusDelta - outputDelta) >= 10) {
    const leadSignal = focusDelta > outputDelta ? 'focus' : 'output';
    const lagSignal = leadSignal === 'focus' ? 'output' : 'focus';
    return `${formatSignalLabel(leadSignal)} is moving ahead of ${formatSignalLabel(lagSignal)} across the latest sessions.`;
  }

  return 'Recent timeline is steady, with focus and output moving in a tight band.';
}
