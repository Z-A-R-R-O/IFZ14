import { motion } from 'framer-motion';
import type { DailyEntry } from '../../../types';
import { type as typeStyles } from '../../../typography';
import { SectionTitle, SignalValue, TextAreaField } from './DailyPrimitives';

type ProductionBlockProps = {
  entry: DailyEntry & {
    values?: {
      outputScore?: number;
      productionOutput?: string;
    };
  };
  update: (updates: Partial<DailyEntry>) => void;
  visual: { border: number };
};

export function ProductionBlock({ entry, update, visual }: ProductionBlockProps) {
  const outputScore = (entry.outputScore || entry.values?.outputScore || 0) * 10;

  return (
    <section className="analytics-card daily-system-panel" style={{ padding: '24px', border: `1px solid rgba(255,255,255,${visual.border})` }}>
      <SectionTitle text="PRODUCTION" i={3} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <TextAreaField
          label="OUTPUT"
          value={entry.productionOutput || entry.values?.productionOutput || ''}
          onChange={(value: string) => update({ productionOutput: value })}
          placeholder="What did you produce?"
          typing
        />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 * 0.04, duration: 0.35 }} className="daily-energy-panel daily-score-panel">
          <div className="daily-energy-head">
            <span className={typeStyles.label}>SCORE</span>
            <SignalValue value={outputScore || '--'} className="metric-number-sm" pulse={Boolean(outputScore)} />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={outputScore}
            onChange={(e) => update({ outputScore: (parseInt(e.target.value, 10) || 0) / 10 })}
            className="daily-energy-slider daily-score-slider"
            aria-label="Production score"
          />
          <div className="daily-energy-ticks daily-score-ticks" aria-hidden="true">
            {Array.from({ length: 11 }, (_, idx) => (
              <span key={idx} className={`daily-energy-tick${outputScore >= idx * 10 ? ' is-active' : ''}`} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
