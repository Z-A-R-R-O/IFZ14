import { motion } from 'framer-motion';
import type { ReactNode, MouseEvent } from 'react';
import { motionTiming } from '../motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface SystemButtonProps {
  children: ReactNode;
  variant?: Variant;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

export default function SystemButton({
  children,
  variant = 'ghost',
  onClick,
  disabled = false,
  active = false,
  className = '',
}: SystemButtonProps) {
  const base: React.CSSProperties = {
    background: 'transparent',
    color: '#fff',
    cursor: disabled ? 'default' : 'pointer',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  };

  const variants: Record<Variant, React.CSSProperties> = {
    primary: {
      padding: '8px 24px',
      border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: '999px',
      fontSize: '12px',
      letterSpacing: '0.15em',
      opacity: active ? 1 : 0.6,
      backdropFilter: 'blur(12px)',
    },
    secondary: {
      padding: '6px 16px',
      border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: '999px',
      fontSize: '11px',
      letterSpacing: '0.15em',
      opacity: active ? 1 : 0.5,
    },
    ghost: {
      padding: '4px 0',
      border: 'none',
      borderRadius: '0',
      fontSize: '11px',
      letterSpacing: '0.15em',
      opacity: 0.4,
    },
    danger: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      letterSpacing: '0.15em',
      opacity: 0.4,
    },
  };

  return (
    <motion.button
      whileHover={!disabled ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.985 } : undefined}
      transition={motionTiming.fast}
      onClick={onClick}
      disabled={disabled}
      className={`system-control system-control--${variant} font-primary-bold ${className}`}
      style={{
        ...base,
        ...variants[variant],
        ...(disabled ? { opacity: 0.15, cursor: 'default' } : {}),
      }}
    >
      {children}
    </motion.button>
  );
}
