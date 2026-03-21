import type { DailyEntry } from '../types';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDailyStore } from '../stores/dailyStore';
import { calculateScore } from '../engines/scoreEngine';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface TimelineItem {
  date: string;
  score: number;
  state: string;
}

function groupByMonth(items: TimelineItem[]): Record<string, TimelineItem[]> {
  const groups: Record<string, TimelineItem[]> = {};
  items.forEach(item => {
    const key = format(parseISO(item.date), 'MMMM yyyy').toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}
// ❗ HARD LOCK
// History is append-only (ZRO principle)
// No edits, no deletes, no mutations allowed
// This page is read-only — it displays completed day logs.

export default function Timeline() {
  const navigate = useNavigate();
  const entries = useDailyStore((s) => s.entries);

  const items: TimelineItem[] = useMemo(() => {
    return (Object.values(entries) as DailyEntry[])
      .filter(e => e.completed)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => {
        let score = 0;
        let state = 'STABLE';
        try {
          const result = calculateScore(e);
          score = result.score;
          state = result.state;
        } catch { /* fallback defaults */ }
        return { date: e.date, score, state };
      });
  }, [entries]);

  const months = useMemo(() => groupByMonth(items), [items]);
  const hasData = items.length > 0;

  return (
    <div style={{ minHeight: '60vh' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-section" style={{ marginBottom: '48px' }}>HISTORY</div>
      </motion.div>

      {!hasData ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div className="text-label" style={{ marginBottom: '12px' }}>No data yet.</div>
          <div className="text-meta">Start logging to activate timeline.</div>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <AnimatePresence>
            {Object.entries(months).map(([month, days], mi) => (
              <motion.div
                key={month}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: mi * 0.08, duration: 0.5 }}
              >
                <div className="text-section" style={{ marginBottom: '24px' }}>{month}</div>
                <div>
                  {days.map((day, di) => {
                    const stateColor = day.state === 'PEAK' ? '#FFF' : day.state === 'RISING' ? '#CCC' : day.state === 'LOW' ? '#555' : '#888';
                    return (
                      <motion.button
                        key={day.date}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: di * 0.03 }}
                        onClick={() => navigate(`/daily?date=${day.date}`)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          padding: '18px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: 'none',
                          border: 'none',
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderBottomColor: 'rgba(255,255,255,0.04)',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFF', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', minWidth: '48px', textAlign: 'left' }}>
                          {format(parseISO(day.date), 'dd')}
                        </span>
                        <span className="text-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          SCORE {day.score}
                        </span>
                        <span style={{ fontSize: '11px', color: stateColor, letterSpacing: '0.12em', textAlign: 'right', minWidth: '80px' }}>
                          {day.state}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
