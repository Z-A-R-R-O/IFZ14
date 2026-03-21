import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { easeSmooth, motionTiming } from '../motion';

type AnimatedMetricProps = {
  value: number | string;
  className?: string;
  style?: CSSProperties;
  pulse?: boolean;
  duration?: number;
};

function toNumericValue(value: number | string) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function formatNumericValue(value: number) {
  return Number.isInteger(value) ? Math.round(value).toString() : value.toFixed(1);
}

export default function AnimatedMetric({
  value,
  className = '',
  style,
  pulse = true,
  duration = 0.48,
}: AnimatedMetricProps) {
  const numericValue = useMemo(() => toNumericValue(value), [value]);
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(numericValue ?? 0);
  const [displayValue, setDisplayValue] = useState(() =>
    numericValue === null ? String(value) : formatNumericValue(numericValue)
  );
  const [pulseTick, setPulseTick] = useState(0);
  const previousValue = useRef<number | null>(numericValue);

  useMotionValueEvent(motionValue, 'change', (latest) => {
    if (numericValue !== null) {
      setDisplayValue(formatNumericValue(latest));
    }
  });

  useEffect(() => {
    if (numericValue === null) {
      setDisplayValue(String(value));
      previousValue.current = null;
      return;
    }

    if (reducedMotion || previousValue.current === null) {
      motionValue.set(numericValue);
      setDisplayValue(formatNumericValue(numericValue));
      previousValue.current = numericValue;
      return;
    }

    if (previousValue.current === numericValue) return;

    const controls = animate(motionValue, numericValue, {
      duration,
      ease: easeSmooth,
    });

    previousValue.current = numericValue;
    if (pulse) setPulseTick((tick) => tick + 1);

    return () => controls.stop();
  }, [duration, motionValue, numericValue, pulse, reducedMotion, value]);

  if (numericValue === null) {
    return <span className={className} style={style}>{String(value)}</span>;
  }

  return (
    <motion.span
      key={pulse ? pulseTick : 'stable'}
      className={className}
      style={style}
      initial={false}
      animate={pulse && !reducedMotion ? { scale: [1, 1.04, 1], opacity: [1, 0.94, 1] } : undefined}
      transition={pulse && !reducedMotion ? { ...motionTiming.medium, times: [0, 0.35, 1] } : undefined}
    >
      {displayValue}
    </motion.span>
  );
}
