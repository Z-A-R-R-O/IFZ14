import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { usePrefsStore } from '../stores/prefsStore';
import { useState } from 'react';
import { exportCSV, exportReport, deleteAllData } from '../utils/exportUtils';
import { AnimatePresence } from 'framer-motion';
import ConfirmOverlay from '../components/ConfirmOverlay';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

function ToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span className="text-label" style={{ fontSize: '14px' }}>{label}</span>
      <button
        className={`ifz14-toggle-switch ${active ? 'active' : ''}`}
        onClick={onToggle}
      />
    </div>
  );
}

function TextRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
      <span className="text-label" style={{ fontSize: '14px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#fff' }}>{value}</span>
    </div>
  );
}

function ActionButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        padding: '10px 24px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'transparent',
        color: danger ? 'rgba(255,255,255,0.5)' : '#8A8A8A',
        fontSize: '12px',
        letterSpacing: '0.12em',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'all 0.3s ease',
        marginTop: '8px',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.color = '#FFFFFF';
        (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.color = danger ? 'rgba(255,255,255,0.5)' : '#8A8A8A';
        (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      {label}
    </button>
  );
}

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const updateName = useAuthStore((s) => s.updateName);
  const autoSave = usePrefsStore((s) => s.autoSave);
  const animations = usePrefsStore((s) => s.animations);
  const toggleAutoSave = usePrefsStore((s) => s.toggleAutoSave);
  const toggleAnimations = usePrefsStore((s) => s.toggleAnimations);

  const [showConfirm, setShowConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [nameSaved, setNameSaved] = useState(false);

  const handleNameSave = () => {
    updateName(nameInput);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleExport = (type: 'csv' | 'report') => {
    setExportStatus('Preparing...');
    setTimeout(() => {
      if (type === 'csv') exportCSV();
      else exportReport();
      setExportStatus('Downloaded');
      setTimeout(() => setExportStatus(''), 2000);
    }, 400);
  };

  return (
    <>
      <motion.div variants={stagger} initial="initial" animate="animate">
        {/* Identity */}
        <motion.section variants={fadeUp}>
          <div className="t-meta" style={{ marginBottom: '20px' }}>IDENTITY</div>
          <TextRow label="EMAIL" value={user?.email || '—'} />
          
          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <span className="text-label" style={{ fontSize: '14px' }}>OPERATOR ALIAS</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', color: '#fff', borderRadius: '6px', outline: 'none', fontSize: '14px' }}
                placeholder="Operator"
              />
              <button
                onClick={handleNameSave}
                style={{
                  padding: '0 16px', background: nameSaved ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: `1px solid ${nameSaved ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: nameSaved ? '#fff' : '#8A8A8A', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease', fontSize: '12px', letterSpacing: '0.1em'
                }}
              >
                {nameSaved ? 'UPDATED' : 'SAVE'}
              </button>
            </div>
            <AnimatePresence>
              {nameSaved && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: '4px' }}>
                  IDENTITY UPDATED
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Preferences */}
        <motion.section variants={fadeUp}>
          <div className="t-meta" style={{ marginBottom: '20px' }}>PREFERENCES</div>
          <ToggleRow label="Auto-save" active={autoSave} onToggle={toggleAutoSave} />
          <ToggleRow label="Animations" active={animations} onToggle={toggleAnimations} />
        </motion.section>

        {/* Data */}
        <motion.section variants={fadeUp}>
          <div className="t-meta" style={{ marginBottom: '20px' }}>DATA</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <ActionButton label="EXPORT REPORT" onClick={() => handleExport('report')} />
            <ActionButton label="DOWNLOAD CSV" onClick={() => handleExport('csv')} />
          </div>
          {exportStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: '12px', color: '#5A5A5A', letterSpacing: '0.1em', marginTop: '12px' }}
            >
              {exportStatus}
            </motion.div>
          )}
        </motion.section>

        {/* Danger Zone */}
        <motion.section variants={fadeUp}>
          <div className="t-meta" style={{ marginBottom: '20px' }}>RESET</div>
          <ActionButton label="DELETE ALL DATA" onClick={() => setShowConfirm(true)} danger />
        </motion.section>
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <ConfirmOverlay
            onConfirm={() => { setShowConfirm(false); deleteAllData(); }}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
