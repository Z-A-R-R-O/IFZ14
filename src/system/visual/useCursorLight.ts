import { useEffect, useState } from "react";

export function useCursorLight() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [smooth, setSmooth] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // 🔥 smoothing loop
  useEffect(() => {
    let frame: number;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const loop = () => {
      setSmooth((prev) => ({
        x: lerp(prev.x, pos.x, 0.1),
        y: lerp(prev.y, pos.y, 0.1),
      }));
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [pos]);

  return smooth;
}
