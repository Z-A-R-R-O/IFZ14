import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const [isEntering, setIsEntering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const x = ((event.clientX / window.innerWidth) - 0.5) * 2;
      const y = ((event.clientY / window.innerHeight) - 0.5) * 2;
      targetRef.current = { x: x * 18, y: y * 13 };
    };

    const handleLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const tick = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.07;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.07;

      if (shellRef.current) {
        shellRef.current.style.setProperty('--intro-x', `${currentRef.current.x}px`);
        shellRef.current.style.setProperty('--intro-y', `${currentRef.current.y}px`);
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', handleLeave);
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  const handleEnter = () => {
    if (isEntering) return;
    setIsEntering(true);
    targetRef.current = { x: 0, y: 0 };

    if (videoRef.current) {
      videoRef.current.playbackRate = 1.2;
      void videoRef.current.play().catch(() => undefined);
    }

    timeoutRefs.current.push(
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.playbackRate = 1.85;
        }
      }, 440),
    );

    timeoutRefs.current.push(window.setTimeout(onEnter, 1825));
  };

  return (
    <motion.div
      className={`auth-screen auth-screen--intro-space${isEntering ? ' is-entering' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="intro-video-wrap" aria-hidden="true">
        <video ref={videoRef} className="intro-video intro-video--raw" autoPlay loop muted playsInline preload="auto">
          <source src="/bg/Evolve.webm" type="video/webm" />
        </video>
      </div>
      <div className="intro-flash" aria-hidden="true" />

      <div className="intro-watermark">IFZ14</div>

      <motion.div
        ref={shellRef}
        className="intro-shell intro-shell--space"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="intro-energy-core" aria-hidden="true" />

        <motion.div
          className="intro-command"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.56 }}
        >
          <button type="button" className="intro-command-button" onClick={handleEnter}>
            EVOLVE
          </button>
        </motion.div>

        <div className="intro-transition-copy" aria-hidden={!isEntering}>
          <p className="intro-transition-title">Prepare your seatbelt</p>
          <p className="intro-transition-subtitle">Crossing light-speed</p>
        </div>
      </motion.div>

      <div className="intro-bottom-hint-wrap">
        <motion.p
          className="intro-bottom-hint"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.86 }}
        >
          Let&apos;s click evolve to ride across lightyears
        </motion.p>
      </div>
    </motion.div>
  );
}
