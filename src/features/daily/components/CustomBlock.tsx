import { motion } from 'framer-motion';
import type { DailyEntry, DayBlock } from '../../../types';
import { type as typeStyles } from '../../../typography';
import { DotToggleRow, SectionTitle, SignalValue, TextAreaField } from './DailyPrimitives';

type CustomBlockProps = {
  block: DayBlock & {
    customType?: 'toggle' | 'number' | 'text';
  };
  entry: DailyEntry;
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
};

export function CustomBlock({ block, entry, update, visual }: CustomBlockProps) {
  const customValues = entry.dynamic_values?.custom || {};
  const value = customValues[block.id];
  const numericValue = typeof value === 'number' ? value : parseInt(String(value || 0), 10) || 0;

  const updateValue = (nextValue: string | number | boolean) => {
    update({
      dynamic_values: {
        ...entry.dynamic_values,
        custom: { ...customValues, [block.id]: nextValue },
      },
    });
  };

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text={block.title.toUpperCase()} i={5} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {block.customType === 'toggle' && (
          <DotToggleRow label="STATUS" active={!!value} onToggle={() => updateValue(!value)} i={0} />
        )}
        {block.customType === 'number' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.35 }} className="daily-energy-panel daily-score-panel">
            <div className="daily-energy-head">
              <span className={typeStyles.label}>VALUE</span>
              <SignalValue value={numericValue || '--'} className="metric-number-sm" pulse={Boolean(numericValue)} />
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={Math.min(10, Math.max(0, numericValue))}
              onChange={(e) => updateValue(Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0)))}
              className="daily-energy-slider daily-custom-number-slider"
              aria-label={`${block.title} value`}
            />
            <div className="daily-energy-ticks" aria-hidden="true">
              {Array.from({ length: 10 }, (_, idx) => (
                <span key={idx} className={`daily-energy-tick${Math.min(10, Math.max(0, numericValue)) > idx ? ' is-active' : ''}`} />
              ))}
            </div>
          </motion.div>
        )}
        {block.customType === 'text' && (
          <TextAreaField label="NOTES" value={String(value || '')} onChange={(nextValue: string) => updateValue(nextValue)} />
        )}
      </div>
    </section>
  );
}
