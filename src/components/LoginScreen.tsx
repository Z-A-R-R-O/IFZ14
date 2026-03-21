import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';

type AuthMode = 'signin' | 'signup';

const shellMotion = {
  initial: { opacity: 0, scale: 0.985, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function LoginScreen({ onBack }: { onBack?: () => void }) {
  const users = useAuthStore((s) => s.users);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessState, setAccessState] = useState<'idle' | 'initiating' | 'verifying' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    if (users.length === 0) {
      setMode('signup');
    }
  }, [users.length]);

  useEffect(() => {
    if (accessState !== 'denied') return undefined;
    const timeout = window.setTimeout(() => setAccessState('idle'), 1100);
    return () => window.clearTimeout(timeout);
  }, [accessState]);

  const submitLabel = useMemo(() => {
    if (accessState === 'initiating') return 'INITIATING...';
    if (accessState === 'verifying') return 'VERIFYING...';
    if (accessState === 'granted') return 'ACCESS GRANTED';
    if (accessState === 'denied') return 'ACCESS DENIED';
    return mode === 'signup' ? 'CONFIGURE ACCESS' : 'INITIATE ACCESS';
  }, [accessState, mode]);

  const resetError = () => setError('');

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    setAccessState('initiating');

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      setAccessState('verifying');

      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Access keys do not match');
          setAccessState('denied');
          return;
        }

        const result = await signUp({ name, email, password });
        if (!result.ok) {
          setError(result.error || 'Unable to configure account');
          setAccessState('denied');
          return;
        }

        setAccessState('granted');
        return;
      }

      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error || 'Authorization failed');
        setAccessState('denied');
        return;
      }

      setAccessState('granted');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      void handleSubmit();
    }
  };

  return (
    <div className="auth-screen auth-screen--minimal-access">
      <motion.div className="auth-background auth-background--minimal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <div className="auth-noise auth-noise--minimal" aria-hidden="true" />
      <div className="auth-core-glow" aria-hidden="true" />
      <div className="auth-vignette" aria-hidden="true" />

      <div className="auth-stage">
        <motion.div
          {...shellMotion}
          className={`auth-shell auth-shell--minimal auth-shell--mode-${mode}`}
        >
          <div className="auth-module-topline">
            {onBack ? (
              <button type="button" className="auth-back-link" onClick={onBack} aria-label="Back to intro">
                <span className="auth-back-arrow">&larr;</span>
                <span>BACK</span>
              </button>
            ) : (
              <span />
            )}
            <span className="auth-kicker">SECURE ACCESS</span>
          </div>

          <div className="auth-intro auth-intro--minimal">
            <motion.h1 className="auth-title">
              InterFrost
            </motion.h1>
            <p className="auth-copy auth-copy--minimal">
              Enter the access chamber and resume your operator session.
            </p>
          </div>

          <div className="auth-divider" aria-hidden="true" />

          <div className="auth-mode-switch" role="tablist" aria-label="Access mode">
            <button
              type="button"
              className={`auth-mode-link${mode === 'signin' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('signin');
                resetError();
              }}
            >
              SIGN IN
            </button>
            <button
              type="button"
              className={`auth-mode-link${mode === 'signup' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('signup');
                resetError();
              }}
            >
              CREATE
            </button>
          </div>

          <div className="auth-form-area">
            <div className="auth-module-header">
              <span className="auth-module-kicker">ACCESS MODULE</span>
              <span className="auth-module-status">
                {mode === 'signup' ? 'CONFIGURE' : 'VERIFY'}
              </span>
            </div>

            <div className="auth-fields auth-fields--minimal">
              <label className={`auth-field auth-field--minimal${email ? ' has-value' : ''}`}>
                <span className="auth-label">OPERATOR ID</span>
                <input
                  className="auth-input auth-input--minimal"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    resetError();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="enter operator id"
                  autoFocus
                />
              </label>

              <label
                className={`auth-field auth-field--minimal auth-field--optional${name ? ' has-value' : ''}${
                  mode === 'signup' ? ' is-visible' : ''
                }`}
                aria-hidden={mode !== 'signup'}
              >
                <span className="auth-label">OPERATOR NAME</span>
                <input
                  className="auth-input auth-input--minimal"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    resetError();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="enter operator name"
                  tabIndex={mode === 'signup' ? 0 : -1}
                />
              </label>

              <label className={`auth-field auth-field--minimal${password ? ' has-value' : ''}`}>
                <span className="auth-label">ACCESS KEY</span>
                <input
                  className="auth-input auth-input--minimal"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    resetError();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'signup' ? 'define access key' : 'enter access key'}
                />
              </label>

              <label
                className={`auth-field auth-field--minimal auth-field--optional${confirmPassword ? ' has-value' : ''}${
                  mode === 'signup' ? ' is-visible' : ''
                }`}
                aria-hidden={mode !== 'signup'}
              >
                <span className="auth-label">CONFIRM KEY</span>
                <input
                  className="auth-input auth-input--minimal"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    resetError();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="repeat access key"
                  tabIndex={mode === 'signup' ? 0 : -1}
                />
              </label>
            </div>
          </div>

          {error ? <p className="auth-error auth-error--minimal">{error}</p> : null}

          <div className="auth-actions auth-actions--minimal">
            <button
              type="button"
              className={`auth-primary auth-primary--minimal is-${accessState}`}
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              <span className="auth-primary-text">{submitLabel}</span>
            </button>

            <div className="auth-meta auth-meta--minimal">
              <span>AUTHORIZED NODE: {users.length || 1}</span>
              <span>ACCESS LEVEL: LOCAL</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
