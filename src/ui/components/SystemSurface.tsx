import { memo, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, surfaceInteraction } from '../motion/presets';

export type SurfaceVariant = 'base' | 'elevated' | 'critical';

type SystemSurfaceProps = {
  children: ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  delay?: number;
  style?: CSSProperties;
  as?: 'div' | 'section';
  interactive?: boolean;
};

function SystemSurfaceComponent({
  children,
  variant = 'base',
  className = '',
  delay = 0,
  style = {},
  as = 'div',
  interactive = true,
}: SystemSurfaceProps) {
  const Component = as === 'section' ? motion.section : motion.div;

  return (
    <Component
      {...fadeInUp(delay, 10)}
      whileHover={interactive ? surfaceInteraction.hover : undefined}
      whileTap={interactive ? surfaceInteraction.tap : undefined}
      className={`ifz14-card surface-${variant} parallax-layer-2 ${className}`.trim()}
      style={style}
    >
      {children}
    </Component>
  );
}

const SystemSurface = memo(SystemSurfaceComponent);

export default SystemSurface;
