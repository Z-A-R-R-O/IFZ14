export function useParallax(pos: { x: number; y: number }) {
  const clamp = (v: number, max: number) =>
    Math.max(Math.min(v, max), -max);

  const { innerWidth, innerHeight } = window;
  const rawX = (pos.x - innerWidth / 2) / 60;
  const rawY = (pos.y - innerHeight / 2) / 60;

  const offsetX = clamp(rawX, 10);
  const offsetY = clamp(rawY, 10);

  return {
    slow: { transform: `translate(${offsetX * 0.3}px, ${offsetY * 0.3}px)` },
    medium: { transform: `translate(${offsetX * 0.6}px, ${offsetY * 0.6}px)` },
    fast: { transform: `translate(${offsetX}px, ${offsetY}px)` }
  };
}
