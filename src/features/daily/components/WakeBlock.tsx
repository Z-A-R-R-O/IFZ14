import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DailyEntry } from '../../../types';
import { SectionTitle, SignalRow, SignalValue } from './DailyPrimitives';
import { type as typeStyles } from '../../../typography';

const DEFAULT_SLEEP_HOURS = 7.5;
const QUICK_SLEEP_HOURS = [6.5, 7, 7.5, 8];
const SLEEP_HOUR_OPTIONS = [4, 5, 6, 7, 8, 9, 10];
const SLEEP_MINUTE_OPTIONS = [0, 15, 30, 45];

function findAdaptiveWakeTime(entries: Record<string, DailyEntry>, currentDate: string) {
  const recentWakeTimes = Object.values(entries)
    .filter((item) => item.date < currentDate && Boolean(item.actualWakeTime))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4)
    .map((item) => item.actualWakeTime as string);

  if (recentWakeTimes.length < 3) return null;
  const [candidate, ...rest] = recentWakeTimes;
  return rest.every((value) => value === candidate) ? candidate : null;
}

export function WakeBlock({
  entry,
  entries,
  update,
  visual,
}: {
  entry: DailyEntry;
  entries: Record<string, DailyEntry>;
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
}) {
  const wakeValue = entry.actualWakeTime || '';
  const sleepValue = entry.totalSleepHours || DEFAULT_SLEEP_HOURS;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isWakePickerOpen, setIsWakePickerOpen] = useState(false);
  const sleepPickerRef = useRef<HTMLDivElement>(null);
  const [isSleepPickerOpen, setIsSleepPickerOpen] = useState(false);
  const [wakeSource, setWakeSource] = useState<'manual' | 'adapted' | null>(null);

  const adaptiveWakeTime = useMemo(() => findAdaptiveWakeTime(entries, entry.date), [entries, entry.date]);
  const recentWakeOptions = useMemo(() => {
    return Object.values(entries)
      .filter((item) => Boolean(item.actualWakeTime))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5)
      .map((item) => ({
        date: item.date,
        time: item.actualWakeTime as string,
      }));
  }, [entries]);

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

  useEffect(() => {
    if (!isSleepPickerOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!sleepPickerRef.current?.contains(event.target as Node)) {
        setIsSleepPickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSleepPickerOpen]);

  useEffect(() => {
    if (!entry.totalSleepHours || entry.totalSleepHours <= 0) {
      update({ totalSleepHours: DEFAULT_SLEEP_HOURS });
    }
  }, [entry.totalSleepHours, update]);

  useEffect(() => {
    if (!wakeValue && adaptiveWakeTime) {
      update({ actualWakeTime: adaptiveWakeTime });
      setWakeSource('adapted');
    }
  }, [adaptiveWakeTime, update, wakeValue]);

  const setWakeTime = (hour12: number, minute: number, period: 'AM' | 'PM') => {
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    const formatted = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    update({ actualWakeTime: formatted });
    setWakeSource('manual');
  };

  const displayWakeValue = wakeValue || '00:00';
  const sleepHours = Math.floor(sleepValue);
  const sleepMinutes = Math.round((sleepValue - sleepHours) * 60);

  const setSleepHours = (hours: number, minutes: number) => {
    update({ totalSleepHours: Number((hours + minutes / 60).toFixed(2)) });
  };

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="WAKE SYSTEM" i={0} />
      <div className="daily-signal-panel">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02, duration: 0.35 }} style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gap: '8px' }} ref={pickerRef}>
            <button
              type="button"
              className={`daily-signal-row daily-wake-trigger${isWakePickerOpen ? ' is-open' : ''}`}
              onClick={() => setIsWakePickerOpen((open) => !open)}
            >
              <span className={typeStyles.label}>OPEN WAKE PICKER</span>
              <span className="daily-signal-value">
                <span className="daily-time-readout">{displayWakeValue}</span>
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
                  style={{ position: 'static', transform: 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                    <button
                      type="button"
                      className="daily-wake-picker-option"
                      onClick={() => setIsWakePickerOpen(false)}
                      aria-label="Close wake picker"
                    >
                      X
                    </button>
                  </div>
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
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => (
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
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div className={typeStyles.label}>LAST WAKE TIMES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {recentWakeOptions.length > 0 ? recentWakeOptions.map(({ date, time }) => (
                <button
                  key={`${date}-${time}`}
                  type="button"
                  className={`daily-wake-picker-option${wakeValue === time ? ' is-active' : ''}`}
                  onClick={() => {
                    update({ actualWakeTime: time });
                    setWakeSource('manual');
                  }}
                >
                  {time}
                </button>
              )) : (
                <div className="body" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)' }}>
                  Recent wake times will appear here after you log them.
                </div>
              )}
            </div>
          </div>
          {wakeSource === 'adapted' ? (
            <div className="body" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.56)' }}>
              Auto-adapted from your recent stable wake pattern.
            </div>
          ) : null}
        </motion.div>

        <SignalRow
          label="WAKE TIME"
          value={<SignalValue value={displayWakeValue} className="metric-number-sm" pulse={Boolean(wakeValue)} />}
          i={1}
        />

        <SignalRow
          label="SLEEP HOURS"
          value={<SignalValue value={sleepValue > 0 ? sleepValue : DEFAULT_SLEEP_HOURS} suffix="H" className="metric-number-sm" pulse />}
          onClick={() => setIsSleepPickerOpen((open) => !open)}
          editable
          i={2}
        />
        <div ref={sleepPickerRef} style={{ display: 'grid', gap: '8px', marginTop: '-4px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {QUICK_SLEEP_HOURS.map((hours) => (
              <button
                key={hours}
                type="button"
                className={`daily-wake-picker-option${Math.abs(sleepValue - hours) < 0.01 ? ' is-active' : ''}`}
                onClick={() => update({ totalSleepHours: hours })}
              >
                {hours.toFixed(1)}H
              </button>
            ))}
          </div>
          <AnimatePresence>
            {isSleepPickerOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="daily-wake-picker-panel"
                style={{ position: 'static', transform: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                  <button
                    type="button"
                    className="daily-wake-picker-option"
                    onClick={() => setIsSleepPickerOpen(false)}
                    aria-label="Close sleep picker"
                  >
                    X
                  </button>
                </div>
                <div className="daily-wake-picker-grid">
                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>HOUR</span>
                    <div className="daily-wake-picker-list">
                      {SLEEP_HOUR_OPTIONS.map((hours) => (
                        <button
                          key={hours}
                          type="button"
                          className={`daily-wake-picker-option${sleepHours === hours ? ' is-active' : ''}`}
                          onClick={() => setSleepHours(hours, sleepMinutes)}
                        >
                          {String(hours).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="daily-wake-picker-col">
                    <span className={typeStyles.label}>MIN</span>
                    <div className="daily-wake-picker-list">
                      {SLEEP_MINUTE_OPTIONS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className={`daily-wake-picker-option${sleepMinutes === minutes ? ' is-active' : ''}`}
                          onClick={() => setSleepHours(sleepHours, minutes)}
                        >
                          {String(minutes).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
