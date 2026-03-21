import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';

const shellMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function LockScreen() {
  const user = useAuthStore((s) => s.user);
  const unlock = useAuthStore((s) => s.unlock);
  const signOut = useAuthStore((s) => s.signOut);

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      const success = await unlock(password);
      if (!success) {
        setError('Incorrect password');
        setPassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen auth-screen--locked">
      <div className="auth-background" aria-hidden="true" />

      <motion.div {...shellMotion} className="auth-shell auth-shell--compact">
        <div className="auth-intro">
          <p className="auth-kicker">SESSION LOCKED</p>
          <h1 className="auth-title">Resume secure access</h1>
          <p className="auth-copy">{user?.email || 'Current operator session is locked.'}</p>
        </div>

        <label className="auth-field">
          <span className="auth-label">PASSWORD</span>
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleUnlock();
            }}
            placeholder="Enter password"
            autoFocus
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <div className="auth-actions">
          <button type="button" className="auth-primary" onClick={() => void handleUnlock()} disabled={isSubmitting}>
            {isSubmitting ? 'VERIFYING' : 'UNLOCK'}
          </button>
          <button type="button" className="auth-secondary" onClick={signOut}>
            SIGN OUT
          </button>
        </div>
      </motion.div>
    </div>
  );
}
