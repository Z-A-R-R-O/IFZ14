import { useEffect, useCallback, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Daily from './pages/Daily';
import Tasks from './pages/Tasks';
import Analytics from './pages/Analytics';
import Goals from './pages/Goals';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import DayLab from './pages/DayLab';
import Timeline from './pages/Timeline';

function IdleWatcher({ children }: { children: ReactNode }) {
  const handleActivity = useCallback(() => {
    // Reserved for future idle behavior.
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [handleActivity]);

  return <>{children}</>;
}

export default function AuthenticatedApp() {
  return (
    <IdleWatcher>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/day-lab" element={<DayLab />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </IdleWatcher>
  );
}
