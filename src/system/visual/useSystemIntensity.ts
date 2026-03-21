export function useSystemIntensity(score: number) {
  const t = score / 100;

  // ease-out curve
  const intensity = 1 - Math.pow(1 - t, 2);

  return {
    glow: 0.02 + intensity * 0.06,
    border: 0.04 + intensity * 0.12,
    speed: 6 - intensity * 3
  };
}
