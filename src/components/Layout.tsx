import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { format } from 'date-fns';
import TopNav from './TopNav';
import ControlPanel from './ControlPanel';
import { useDailyStore } from '../stores/dailyStore';
import { calculateScore } from '../engines/scoreEngine';

const pageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const pageTransition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1],
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTemplateId = useDailyStore((s) => s.activeTemplateId);
  const isDashboard = location.pathname === '/';
  const isDayLab = location.pathname === '/day-lab';
  const hideNav = isDayLab;

  // Reactivity Physics (Intensity Layer)
  const todayEntry = useDailyStore(s => s.entries[format(new Date(), 'yyyy-MM-dd')]);
  const systemScore = todayEntry ? calculateScore(todayEntry).score : 0;
  const intensity = systemScore / 100;

  // 60FPS Cursor Tracker (React-Safe, CSS-Variable Driven)
  useEffect(() => {
    let frame = 0;
    let nextX = window.innerWidth / 2;
    let nextY = window.innerHeight / 2;

    const flushCursor = () => {
      frame = 0;
      document.documentElement.style.setProperty('--cursor-x', `${nextX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${nextY}px`);
    };

    const handleMove = (e: MouseEvent) => {
      nextX = e.clientX;
      nextY = e.clientY;
      if (!frame) frame = window.requestAnimationFrame(flushCursor);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!activeTemplateId && !isDayLab) {
      // Future architecture check
    }
  }, [activeTemplateId, isDayLab, navigate]);

  return (
    <div className="dash-breathe-flicker layout-container" style={{ minHeight: '100vh', position: 'relative', '--intensity': intensity } as React.CSSProperties}>
      {/* ── REALISM LAYER: Light, Vignette, Scanlines ── */}
      <div className="cursor-light-physics" />
      <div className="scanlines" />
      <div className="vignette" />

      {/* Dynamic Background Depth System (Parallax Layer 1) */}
      <div 
        className="ifz14-bg parallax-layer-1" 
        style={{
          background: `radial-gradient(circle at 20% 10%, rgba(255,255,255,${0.07 * intensity}), transparent 60%), radial-gradient(circle at 80% 90%, rgba(255,255,255,${0.05 * intensity}), transparent 70%), radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.02 * intensity}), transparent 80%), #000`,
          opacity: 0.03 + intensity * 0.05
        }}
      >
        <div className="ifz14-bg-grid" />
      </div>

      {!hideNav && <TopNav />}
      {!hideNav && <ControlPanel />}
      <motion.main
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        transition={pageTransition}
      >
        <div className={`${isDashboard ? 'ifz14-canvas' : 'ifz14-canvas--narrow'} ifz14-page`}>
          <Outlet />
        </div>
      </motion.main>
    </div>
  );
}
