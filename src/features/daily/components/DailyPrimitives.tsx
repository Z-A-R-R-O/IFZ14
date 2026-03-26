import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import AnimatedMetric from '../../../components/AnimatedMetric';
import { formatHeadingText, type as typeStyles } from '../../../typography';

export function SignalValue({
  value,
  suffix = '',
  className = 'metric-number-xs',
  pulse = true,
}: {
  value: number | string | null | undefined;
  suffix?: string;
  className?: string;
  pulse?: boolean;
}) {
  if (value === undefined || value === null || value === '') {
    return <span className={className}>--</span>;
  }

  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value))) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
        <AnimatedMetric value={value} className={className} pulse={pulse} />
        {suffix ? <span className={typeStyles.label}>{suffix}</span> : null}
      </span>
    );
  }

  return <span className={className}>{String(value)}</span>;
}

export function SectionTitle({ text, i }: { text: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="daily-section-title heading-sm text-[13px] text-white"
    >
      {formatHeadingText(text)}
    </motion.div>
  );
}

export function SignalRow({
  label,
  value,
  onClick,
  isEmpty = false,
  editable = false,
  i = 0,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  isEmpty?: boolean;
  editable?: boolean;
  i?: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.35 }}
      className={`daily-signal-row${editable ? ' is-editable' : ''}${isEmpty ? ' is-empty' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={typeStyles.label}>{label}</span>
      <span className="daily-signal-value">{value}</span>
      {editable ? <span className="daily-signal-underline" /> : null}
    </motion.button>
  );
}

export function DotToggleRow({
  label,
  active,
  onToggle,
  i = 0,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  i?: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.35 }}
      className="daily-dot-toggle-row"
      onClick={onToggle}
    >
      <span className={typeStyles.label}>{label}</span>
      <span className={`daily-dot-toggle${active ? ' is-active' : ''}`} aria-hidden="true" />
    </motion.button>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  i = 0,
  typing = false,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  i?: number;
  typing?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="daily-field">
      {label ? <div className="daily-field-head"><div className={typeStyles.label}>{label}</div></div> : null}
      <div className="daily-input-shell">
        <textarea
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`daily-textarea font-secondary text-[14px] ${typing ? 'daily-textarea-typing' : ''}`}
        />
        <div className="daily-input-line" />
      </div>
    </motion.div>
  );
}

export function useDebounce(fn: (...args: unknown[]) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]);
}
