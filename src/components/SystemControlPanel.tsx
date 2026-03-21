import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDailyStore } from '../stores/dailyStore';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  onOpenGenerator: () => void;
}

export default function SystemControlPanel({ isOpen, onClose, selectedDate, onDateChange, onOpenGenerator }: Props) {
  const navigate = useNavigate();
  const entries = useDailyStore((s) => s.entries);
  const updateEntry = useDailyStore((s) => s.updateEntry);

  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setConfirmReset(false);
  }, [isOpen]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const handleDuplicate = () => {
    if (!selectedDate) return;
    const currentEntry = entries[selectedDate];
    if (!currentEntry) return;
    const tomorrow = format(new Date(new Date(selectedDate).getTime() + 86400000), 'yyyy-MM-dd');
    updateEntry(tomorrow, {
      structure_snapshot: currentEntry.structure_snapshot,
      dynamic_values: currentEntry.dynamic_values,
    });
    if (onDateChange) onDateChange(tomorrow);
    onClose();
  };

  const handleResetToday = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    const date = selectedDate || today;
    updateEntry(date, {
      totalSleepHours: 0, actualWakeTime: '', energyLevel: 0,
      gymTraining: 'skipped', jawlineWorkout: false,
      dw1FocusQuality: 0, dw2FocusQuality: 0,
      productionOutput: '', outputScore: 0, dailyLessons: '',
      completed: false, dynamic_values: {},
    });
    setConfirmReset(false);
    onClose();
  };

  const handleJump = (date: string) => {
    if (onDateChange) onDateChange(date);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 300,
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0,
              height: '100vh', width: '320px',
              background: 'rgba(5, 5, 5, 0.95)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px',
              zIndex: 310, padding: '40px 24px',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <div className="text-section" style={{ marginBottom: '8px' }}>DAY SYSTEM</div>
            </div>

            <Divider />

            {/* ACTIONS */}
            <div style={{ marginBottom: '32px' }}>
              <div className="text-section" style={{ marginBottom: '16px' }}>ACTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ActionBtn label="Build New Day" onClick={() => { onClose(); onOpenGenerator(); }} />
                <ActionBtn label="View History" onClick={() => { onClose(); navigate('/timeline'); }} />
                <ActionBtn label="Open Lab Editor" onClick={() => { onClose(); navigate('/day-lab'); }} />
              </div>
            </div>

            <Divider />

            {/* SYSTEM */}
            <div style={{ marginBottom: '32px' }}>
              <div className="text-section" style={{ marginBottom: '16px' }}>SYSTEM</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ActionBtn label="Duplicate Day" onClick={handleDuplicate} />
                <ActionBtn label={confirmReset ? 'Confirm Reset' : 'Reset Day'} onClick={handleResetToday} warn={confirmReset} />
              </div>
            </div>

            <Divider />

            {/* JUMP */}
            <div>
              <div className="text-section" style={{ marginBottom: '16px' }}>JUMP</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ActionBtn label="Today" onClick={() => handleJump(today)} />
                <ActionBtn label="Yesterday" onClick={() => handleJump(yesterday)} />
                <ActionBtn label="Last Week" onClick={() => handleJump(format(subDays(new Date(), 7), 'yyyy-MM-dd'))} />
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Divider() {
  return <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '32px' }} />;
}

// Note: TemplateBtn removed since Custom and Built-In modes are no longer handled here.

function ActionBtn({ label, onClick, warn }: { label: string; onClick: () => void; warn?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: warn ? '#C44' : '#888',
        fontSize: '14px', letterSpacing: '0.04em', cursor: 'pointer',
        textAlign: 'left', padding: '8px 12px',
        display: 'flex', alignItems: 'center',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = warn ? '#F66' : '#FFF')}
      onMouseLeave={(e) => (e.currentTarget.style.color = warn ? '#C44' : '#888')}
    >
      {label}
    </button>
  );
}
