import { Suspense, lazy, useEffect, useState } from 'react';
import IntroScreen from './components/IntroScreen';
import LoginScreen from './components/LoginScreen';
import LockScreen from './components/LockScreen';
import { useAuthStore } from './stores/authStore';
import { rehydrateScopedStores } from './stores/rehydrateScopedStores';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

function AuthBootScreen() {
  return (
    <div className="auth-screen auth-screen--boot">
      <div className="auth-background" aria-hidden="true" />
      <div className="auth-shell auth-shell--compact">
        <p className="auth-kicker">SYSTEM INITIALIZING</p>
        <h1 className="auth-title">Preparing secure session</h1>
      </div>
    </div>
  );
}

export default function App() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const isLocked = useAuthStore((s) => s.isLocked);
  const [authStage, setAuthStage] = useState<'intro' | 'login'>('intro');
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    void initialize();
  }, [hydrated, initialize]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const bootScopedStores = async () => {
      if (!user) {
        if (!cancelled) setStoresReady(true);
        return;
      }

      if (!cancelled) setStoresReady(false);
      await rehydrateScopedStores();
      if (!cancelled) setStoresReady(true);
    };

    void bootScopedStores();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user?.id]);

  if (!hydrated || !storesReady) {
    return <AuthBootScreen />;
  }

  if (!user) {
    if (authStage === 'intro') {
      return <IntroScreen onEnter={() => setAuthStage('login')} />;
    }
    return <LoginScreen onBack={() => setAuthStage('intro')} />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <Suspense fallback={<AuthBootScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
