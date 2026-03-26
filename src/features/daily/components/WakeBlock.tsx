import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DailyEntry } from '../../../types';
import { SectionTitle, SignalRow, SignalValue } from './DailyPrimitives';
import { type as typeStyles } from '../../../typography';

export function WakeBlock({
  entry,
  update,
  visual,
}: {
  entry: DailyEntry;
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
}) {
  const wakeValue = entry.actualWakeTime || '';
  const sleepValue = entry.totalSleepHours || 0;
  const sleepInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isWakePickerOpen, setIsWakePickerOpen] = useState(false);

  const parseWakeParts = useMemo(() => {
    const [rawHour, rawMinute] = (wakeValue || '07:00').split(':').map((part) => parseInt(part, 10));
    const safeHour = Number.isFinite(rawHour) ? rawHour : 7;
    const safeMinute = Number.isFinite(rawMinute) ? rawMinute : 0;
    const period: 'AM' | 'PM' = safeHour >= 12 ? 'PM' : 'AM';
    const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
    return { hour12, minute: safeMinute, period };
  }, [wakeValue]);

  useEffect(() => {
    if (!isWakePickerOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsWakePickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isWakePickerOpen]);

  const setWakeTime = (hour12: number, minute: number, period: 'AM' | 'PM') => {
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    const formatted = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    update({ actualWakeTime: formatted });
  };

  const displayWakeValue = wakeValue || '00:00';

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="WAKE SYSTEM" i={0} />
      <div className="daily-signal-panel">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.35 }} className="daily-wake-picker-shell" ref={pickerRef}>
          <button
            type="button"
            className={`daily-signal-row daily-wake-trigger${!wakeValue ? ' is-empty' : ''}${isWakePickerOpen ? ' is-open' : ''}`}
            onClick={() => setIsWakePickerOpen((open) => !open)}
          >
            <span className={typeStyles.label}>WAKE TIME</span>
            <span className="daily-signal-value">
              <span className={`daily-time-readout${!wakeValue ? ' is-empty' : ''}`}>{displayWakeValue}</span>
            </span>
            <span className="daily-signal-underline" />
          </button>

          <AnimatePresence>
            {isWakePickerOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="daily-wake-picker-panel"
              >
                <div className="daily-wake-picker-grid">
                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>HOUR</span>
                    <div className="daily-wake-picker-list">
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.hour12 === hour ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(hour, parseWakeParts.minute, parseWakeParts.period)}
                        >
                          {String(hour).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>MIN</span>
                    <div className="daily-wake-picker-list">
                      {[0, 15, 30, 45].map((minute) => (
                        <button
                          key={minute}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.minute === minute ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(parseWakeParts.hour12, minute, parseWakeParts.period)}
                        >
                          {String(minute).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="daily-wake-picker-col daily-wake-picker-col--period">
                    <span className={typeStyles.label}>ZONE</span>
                    <div className="daily-wake-picker-list">
                      {(['AM', 'PM'] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={`daily-wake-picker-option${parseWakeParts.period === period ? ' is-active' : ''}`}
                          onClick={() => setWakeTime(parseWakeParts.hour12, parseWakeParts.minute, period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <SignalRow
          label="SLEEP"
          value={<SignalValue value={sleepValue > 0 ? sleepValue : '--'} suffix={sleepValue > 0 ? 'H' : ''} className="metric-number-sm" pulse={sleepValue > 0} />}
          onClick={() => sleepInputRef.current?.focus()}
          editable
          i={2}
        />
        <input
          ref={sleepInputRef}
          type="number"
          step="0.1"
          min="0"
          value={sleepValue || ''}
          onChange={(e) => update({ totalSleepHours: parseFloat(e.target.value) || 0 })}
          className="daily-signal-hidden-input"
          aria-label="Sleep hours"
        />
      </div>
    </section>
  );
}
