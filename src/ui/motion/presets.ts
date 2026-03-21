import { motionTiming } from '../../motion';

export const uiMotion = {
  fast: motionTiming.fast,
  smooth: motionTiming.medium,
  slow: motionTiming.slow,
} as const;

export function fadeInUp(delay = 0, y = 10) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { ...uiMotion.smooth, delay },
  } as const;
}

export function staggerReveal(delayChildren = 0, staggerChildren = 0.08) {
  return {
    initial: {},
    animate: {
      transition: {
        delayChildren,
        staggerChildren,
      },
    },
  } as const;
}

export const surfaceInteraction = {
  hover: { y: -1 },
  tap: { scale: 0.998, y: 0 },
} as const;
