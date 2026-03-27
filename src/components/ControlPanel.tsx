import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDailyStore } from '../stores/dailyStore';
import { useGoalStore } from '../stores/goalStore';
import { useTaskStore } from '../stores/taskStore';
import { exportCSV, exportReport, deleteAllData } from '../utils/exportUtils';
import ConfirmOverlay from './ConfirmOverlay';

interface PanelItemProps {
  label: string;
  sub?: string;
  icon: string;
  status?: string;
  onClick: () => void;
  danger?: boolean;
  caution?: boolean;
}

function PanelItem({ label, sub, icon, status, onClick, danger, caution }: PanelItemProps) {
  const className = [
    'control-panel-item',
    danger ? 'is-danger' : '',
    caution ? 'is-caution' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="control-panel-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="control-panel-item-copy">
        <span className="control-panel-item-row">
          <span className="control-panel-item-title">{label}</span>
          {status ? <span className="control-panel-item-status">{status}</span> : null}
        </span>
        {sub ? <span className="control-panel-item-sub">{sub}</span> : null}
      </span>
    </button>
  );
}

function SectionLabel({ text, tone = 'default' }: { text: string; tone?: 'default' | 'critical' | 'danger' }) {
  return <div className={`control-panel-section-label is-${tone}`}>{text}</div>;
}

export default function ControlPanel() {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const lock = useAuthStore((s) => s.lock);
  const signOut = useAuthStore((s) => s.signOut);
  const isLocked = useAuthStore((s) => s.isLocked);
  const remoteSyncStatus = useDailyStore((s) => s.remoteSyncStatus);
  const remoteSyncError = useDailyStore((s) => s.remoteSyncError);
  const lastRemoteSyncAt = useDailyStore((s) => s.lastRemoteSyncAt);
  const retryRemoteSync = useDailyStore((s) => s.retryRemoteSync);
  const taskSyncStatus = useTaskStore((s) => s.remoteSyncStatus);
  const taskSyncError = useTaskStore((s) => s.remoteSyncError);
  const taskLastSyncAt = useTaskStore((s) => s.lastRemoteSyncAt);
  const retryTaskSync = useTaskStore((s) => s.retryRemoteSync);
  const goalSyncStatus = useGoalStore((s) => s.remoteSyncStatus);
  const goalSyncError = useGoalStore((s) => s.remoteSyncError);
  const goalLastSyncAt = useGoalStore((s) => s.lastRemoteSyncAt);
  const retryGoalSync = useGoalStore((s) => s.retryRemoteSync);
  const navigate = useNavigate();
  const sideOffset = 'max(24px, calc((100vw - 1100px) / 2 + 24px))';

  const syncStatusLabel =
    remoteSyncStatus === 'syncing'
      ? 'SYNCING'
      : remoteSyncStatus === 'synced'
        ? 'SYNCED'
        : remoteSyncStatus === 'error'
          ? 'ERROR'
          : 'LOCAL';

  const syncStatusSub =
    remoteSyncStatus === 'error'
      ? remoteSyncError || 'Remote sync failed'
      : lastRemoteSyncAt
        ? `Last sync ${new Date(lastRemoteSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Daily entries are running in local-first mode';

  const taskStatusLabel =
    taskSyncStatus === 'syncing'
      ? 'SYNCING'
      : taskSyncStatus === 'synced'
        ? 'SYNCED'
        : taskSyncStatus === 'error'
          ? 'ERROR'
          : 'LOCAL';

  const taskStatusSub =
    taskSyncStatus === 'error'
      ? taskSyncError || 'Task sync failed'
      : taskLastSyncAt
        ? `Last sync ${new Date(taskLastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Tasks are running in local-first mode';

  const goalStatusLabel =
    goalSyncStatus === 'syncing'
      ? 'SYNCING'
      : goalSyncStatus === 'synced'
        ? 'SYNCED'
        : goalSyncStatus === 'error'
          ? 'ERROR'
          : 'LOCAL';

  const goalStatusSub =
    goalSyncStatus === 'error'
      ? goalSyncError || 'Goal sync failed'
      : goalLastSyncAt
        ? `Last sync ${new Date(goalLastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Goals are running in local-first mode';

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      const trigger = document.getElementById('control-trigger');
      if (trigger && trigger.contains(e.target as Node)) return;
      setOpen(false);
    }
  }, []);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, handleClickOutside, handleEsc]);

  const handleAction = (key: string, message: string, action: () => void, delay = 600) => {
    setFeedback((prev) => ({ ...prev, [key]: message }));
    setTimeout(() => {
      action();
      setFeedback((prev) => ({ ...prev, [key]: '' }));
    }, delay);
  };

  const handleExport = (type: 'csv' | 'report', key: string) => {
    setFeedback((prev) => ({ ...prev, [key]: 'COMPILING' }));
    setTimeout(() => {
      if (type === 'csv') exportCSV();
      else exportReport();
      setFeedback((prev) => ({ ...prev, [key]: 'DOWNLOADED' }));
      setTimeout(() => setFeedback((prev) => ({ ...prev, [key]: '' })), 1600);
    }, 350);
  };

  const handleDeleteConfirm = () => {
    setShowConfirm(false);
    setOpen(false);
    deleteAllData();
  };

  return (
    <>
      <button
        id="control-trigger"
        type="button"
        onClick={() => setOpen(!open)}
        className={`control-trigger${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close system controls' : 'Open system controls'}
      >
        |||
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="control-panel-backdrop"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="control-panel-shell"
            style={{ right: sideOffset }}
          >
            <div className="control-panel-header">
              <p className="control-panel-kicker">CONTROL PANEL</p>
              <p className="control-panel-subhead">SYSTEM ACCESS</p>
            </div>

            <section className="control-panel-section">
              <SectionLabel text="CONTROL" />
              <PanelItem
                label={feedback.Preferences || 'Preferences'}
                sub="Modify system parameters"
                icon="CFG"
                status="ACTIVE"
                onClick={() =>
                  handleAction('Preferences', 'OPENING', () => {
                    setOpen(false);
                    navigate('/settings');
                  }, 240)
                }
              />
              <PanelItem
                label={feedback.Settings || 'Settings'}
                sub="Adjust core environment"
                icon="SYS"
                status="DEFAULT"
                onClick={() =>
                  handleAction('Settings', 'OPENING', () => {
                    setOpen(false);
                    navigate('/settings');
                  }, 240)
                }
              />
            </section>

            <section className="control-panel-section">
              <SectionLabel text="DATA" />
              <PanelItem
                label={feedback['Daily Sync'] || 'Daily Sync'}
                sub={syncStatusSub}
                icon="DB"
                status={syncStatusLabel}
                caution={remoteSyncStatus === 'error'}
                onClick={() =>
                  handleAction('Daily Sync', 'RETRYING', () => {
                    void retryRemoteSync();
                  }, 120)
                }
              />
              <PanelItem
                label={feedback['Task Sync'] || 'Task Sync'}
                sub={taskStatusSub}
                icon="TSK"
                status={taskStatusLabel}
                caution={taskSyncStatus === 'error'}
                onClick={() =>
                  handleAction('Task Sync', 'RETRYING', () => {
                    void retryTaskSync();
                  }, 120)
                }
              />
              <PanelItem
                label={feedback['Goal Sync'] || 'Goal Sync'}
                sub={goalStatusSub}
                icon="GOL"
                status={goalStatusLabel}
                caution={goalSyncStatus === 'error'}
                onClick={() =>
                  handleAction('Goal Sync', 'RETRYING', () => {
                    void retryGoalSync();
                  }, 120)
                }
              />
              <PanelItem
                label="Export Report"
                sub="Compile weekly report"
                icon="RPT"
                status={feedback['Export Report'] || 'READY'}
                onClick={() => handleExport('report', 'Export Report')}
              />
              <PanelItem
                label="Download CSV"
                sub="Export raw system logs"
                icon="CSV"
                status={feedback['Download CSV'] || 'AVAILABLE'}
                onClick={() => handleExport('csv', 'Download CSV')}
              />
            </section>

            <section className="control-panel-section">
              <SectionLabel text="SECURITY" tone="critical" />
              <PanelItem
                label={feedback['Lock System'] || 'Lock System'}
                sub="Restrict active access"
                icon="LCK"
                status={isLocked ? 'LOCKED' : 'UNLOCKED'}
                onClick={() =>
                  handleAction('Lock System', 'LOCKING', () => {
                    setOpen(false);
                    lock();
                  })
                }
              />
              <PanelItem
                label={feedback.Logout || 'Logout'}
                sub="Terminate active session"
                icon="EXT"
                status="EXIT"
                caution
                onClick={() =>
                    handleAction('Logout', 'EXITING', () => {
                      setOpen(false);
                      signOut();
                    })
                }
              />
            </section>

            <section className="control-panel-section is-danger">
              <SectionLabel text="DANGER ZONE" tone="danger" />
              <PanelItem
                label={feedback.Delete || 'Delete All Data'}
                sub="Irreversible system wipe"
                icon="DEL"
                status="WIPE"
                danger
                onClick={() => setShowConfirm(true)}
              />
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirm && <ConfirmOverlay onConfirm={handleDeleteConfirm} onCancel={() => setShowConfirm(false)} />}
      </AnimatePresence>
    </>
  );
}
