export const easeSmooth = [0.22, 1, 0.36, 1] as const;

export const motionTiming = {
  fast: { duration: 0.18, ease: easeSmooth },
  medium: { duration: 0.36, ease: easeSmooth },
  slow: { duration: 0.6, ease: easeSmooth },
} as const;

export const dashboardSequence = {
  heading: 0,
  score: 0.1,
  cards: 0.2,
  hud: 0.3,
  footer: 0.4,
} as const;
