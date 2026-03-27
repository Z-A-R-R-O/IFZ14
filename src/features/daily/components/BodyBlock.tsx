import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBiometricStore } from '../../../stores/biometricStore';
import type { DailyEntry } from '../../../types';
import { DotToggleRow, SectionTitle, SignalValue } from './DailyPrimitives';
import { type as typeStyles } from '../../../typography';

export function BodyBlock({
  entry,
  update,
  visual,
}: {
  entry: DailyEntry;
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
}) {
  const navigate = useNavigate();
  const habits = useBiometricStore((s) => s.habits);
  const activeHabits = useMemo(() => habits.filter((habit) => habit.isActive).sort((a, b) => a.order - b.order), [habits]);
  const energy = entry.efficiencyRating ?? entry.energyLevel;
  const habitValues: Record<string, string | number | boolean> = entry.dynamic_values?.bodyHabits || {};

  const setHabitValue = (habitId: string, value: string | number | boolean) => {
    const previous = entry.dynamic_values?.bodyHabits || {};
    update({
      dynamic_values: {
        ...(entry.dynamic_values || {}),
        bodyHabits: { ...previous, [habitId]: value },
      },
      ...(habitId === 'gym' ? { gymTraining: value ? 'completed' : 'skipped' } : {}),
      ...(habitId === 'jawline' ? { jawlineWorkout: Boolean(value) } : {}),
    });
  };

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle text="BODY SYSTEM" i={1} />
        <button
          onClick={() => navigate('/biometrics')}
          className="font-mono"
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '4px 12px',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          OPEN LAB
        </button>
      </div>

      <div className="daily-signal-panel">
        {activeHabits.map((habit, index) => {
          const value = habitValues[habit.id];

          if (habit.type === 'toggle') {
            return (
              <DotToggleRow
                key={habit.id}
                label={habit.name.toUpperCase()}
                active={Boolean(value)}
                onToggle={() => setHabitValue(habit.id, !value)}
                i={index + 2}
              />
            );
          }

          if (habit.type === 'rating') {
            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 2) * 0.04, duration: 0.35 }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}
              >
                <span className={typeStyles.label} style={{ opacity: 0.72 }}>{habit.name.toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={Number(value) || 5}
                    onChange={(e) => setHabitValue(habit.id, parseInt(e.target.value, 10))}
                    className="daily-energy-slider"
                    style={{ width: '80px' }}
                  />
                  <SignalValue value={Number(value) || '--'} className="metric-number-xs" pulse={Boolean(value)} />
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index + 2) * 0.04, duration: 0.35 }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}
            >
              <span className={typeStyles.label} style={{ opacity: 0.72 }}>{habit.name.toUpperCase()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  min="0"
                  max="180"
                  step="5"
                  value={Number(value) || ''}
                  placeholder="0"
                  onChange={(e) => setHabitValue(habit.id, parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '52px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '6px 8px',
                    color: '#fff',
                    borderRadius: '6px',
                    outline: 'none',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'right',
                  }}
                />
                <span className="font-mono" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>MIN</span>
              </div>
            </motion.div>
          );
        })}

        {activeHabits.length === 0 && (
          <div className={typeStyles.label} style={{ padding: '16px 0', opacity: 0.42, textAlign: 'center' }}>
            No active habits. Open Lab to add some.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (activeHabits.length + 2) * 0.04, duration: 0.35 }}
          className="daily-energy-panel"
        >
          <div className="daily-energy-head">
            <span className={typeStyles.label}>EFFICIENCY</span>
            <SignalValue value={energy || '--'} className="metric-number-sm" pulse={Boolean(energy)} />
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={energy || 5}
            onChange={(e) => update({ efficiencyRating: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 5)) })}
            className="daily-energy-slider"
            aria-label="Efficiency rating"
          />
          <div className="daily-energy-ticks" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className={`daily-energy-tick${(energy || 5) > index ? ' is-active' : ''}`} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
