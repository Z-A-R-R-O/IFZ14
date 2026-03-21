import { motion } from 'framer-motion';

interface ConfirmOverlayProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmOverlay({ onConfirm, onCancel }: ConfirmOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 160,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '380px',
          padding: '32px',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          textAlign: 'center',
        }}
      >
        <div style={{
          fontSize: '12px',
          letterSpacing: '0.2em',
          color: '#5A5A5A',
          marginBottom: '20px',
        }}>
          CONFIRM SYSTEM RESET
        </div>

        <div style={{
          fontSize: '14px',
          fontWeight: 300,
          color: '#8A8A8A',
          lineHeight: 1.7,
          marginBottom: '32px',
        }}>
          This will erase all logs, tasks, and reports.
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 32px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#FFFFFF';
              (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
              (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            CONFIRM
          </button>

          <button
            onClick={onCancel}
            style={{
              padding: '8px 32px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: '#5A5A5A',
              fontSize: '12px',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#8A8A8A';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = '#5A5A5A';
            }}
          >
            CANCEL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
