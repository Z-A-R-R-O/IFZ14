import type { DailyEntry } from '../types';

/**
 * Shared Deep Work Extractors — Single source of truth for reading
 * deep work data from both dynamic and legacy DailyEntry fields.
 *
 * Priority: dynamic_values (primary) → legacy fields (fallback)
 *
 * Scale conventions:
 *   - Dynamic sessions:  focus/quality = 0–100
 *   - Legacy fields:     dw1/dw2FocusQuality = 0–10
 *   - Output:            0–10 (normalized)
 */

/**
 * Returns the average deep work focus quality for an entry on a 0–10 scale.
 *
 * Reads: dynamic_values.dwSessions[].focus|quality (0–100, normalized /10)
 * Fallback: (dw1FocusQuality + dw2FocusQuality) / 2
 */
export function getDeepWorkFocus(entry: DailyEntry): number {
  const sessions = entry.dynamic_values?.dwSessions;
  if (Array.isArray(sessions) && sessions.length > 0) {
    return sessions.reduce(
      (a: number, s: any) => a + (s.focus || s.quality || 0), 0
    ) / sessions.length / 10;
  }
  return ((entry.dw1FocusQuality || 0) + (entry.dw2FocusQuality || 0)) / 2;
}

/**
 * Returns true if the entry has at least one deep work session that
 * meets the quality threshold (≥6 on a 0–10 scale, or ≥60 on 0–100).
 *
 * Used by StreakEngine to count consecutive deep work days.
 */
export function hasQualityDeepWork(entry: DailyEntry): boolean {
  const sessions = entry.dynamic_values?.dwSessions;
  const qualities = entry.dynamic_values?.dwQualities;

  // Dynamic sessions (0–100 scale)
  if (Array.isArray(sessions) && sessions.length > 0) {
    return sessions.some((s: any) => (s.focus || s.quality || 0) >= 60);
  }

  // Dynamic qualities array (0–10 scale)
  if (Array.isArray(qualities) && qualities.length > 0) {
    return qualities.some((q: number) => q >= 6);
  }

  // Legacy fields (0–10 scale)
  return (entry.dw1FocusQuality || 0) >= 6 || (entry.dw2FocusQuality || 0) >= 6;
}

/**
 * Compares focus of first session vs second session.
 * Returns: 1 if morning stronger, -1 if afternoon stronger, 0 if equal or insufficient data.
 *
 * Used by InsightEngine for timing analysis.
 */
export function compareSessionTiming(entry: DailyEntry): number {
  const sessions = entry.dynamic_values?.dwSessions;
  if (Array.isArray(sessions) && sessions.length >= 2) {
    const first = sessions[0]?.focus || 0;
    const second = sessions[1]?.focus || 0;
    return first > second ? 1 : first < second ? -1 : 0;
  }
  const dw1 = entry.dw1FocusQuality || 0;
  const dw2 = entry.dw2FocusQuality || 0;
  return dw1 > dw2 ? 1 : dw1 < dw2 ? -1 : 0;
}
