import { useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedMetric from '../components/AnimatedMetric';
import { dashboardSequence, motionTiming } from '../motion';
import { type as typeStyles } from '../typography';
import SystemSurface from '../ui/components/SystemSurface';
import { uiMotion } from '../ui/motion/presets';
import { useAnalyticsModel } from '../features/analytics/hooks/useAnalyticsModel';
import { formatSignalLabel } from '../features/analytics/lib/signals';

const motionConfig = uiMotion;

export default function Analytics() {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const {
    causationRows,
    focusPath,
    focusPoints,
    graphHeight,
    graphPadding,
    graphSeries,
    graphWidth,
    hoveredGraphPoint,
    outputPath,
    outputPoints,
    patternMemory,
    prediction,
    predictionStatements,
    primarySignal,
    riskState,
    systemInsights,
    timelineSummary,
    trendState,
    weeklyAnalysis,
  } = useAnalyticsModel(hoveredPointIndex);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionTiming.slow}
      style={{ paddingBottom: '60px' }}
    >
      <div style={{ marginBottom: '42px' }}>
        <motion.p
          className={typeStyles.identityLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...motionTiming.fast, delay: dashboardSequence.heading }}
          style={{ marginBottom: '12px' }}
        >
          SYSTEM ONLINE
        </motion.p>
        <motion.h1
          className={typeStyles.hero}
          initial={{ opacity: 0, y: 12, letterSpacing: '0.14em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.09em' }}
          transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.08 }}
          style={{ marginBottom: '10px' }}
        >
          ANALYTICS MODE
        </motion.h1>
        <motion.p
          className="body"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...motionTiming.medium, delay: dashboardSequence.heading + 0.14 }}
          style={{ color: 'rgba(255,255,255,0.66)' }}
        >
          Causation active. Patterns detected.
        </motion.p>
      </div>

      <SystemSurface
        as="section"
        variant="elevated"
        delay={dashboardSequence.score}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
      
        <div>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            SYSTEM TREND
          </div>
          <div className="heading-sm" style={{ fontSize: '22px', color: 'rgba(255,255,255,0.94)', marginBottom: '10px' }}>
            {trendState.label}
          </div>
          <div className="body" style={{ color: 'rgba(255,255,255,0.54)' }}>
            {trendState.note}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            PRIMARY METRIC SIGNAL
          </div>
          <div className="score-number" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            <AnimatedMetric value={primarySignal} />
          </div>
          <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.44)' }}>
            SYSTEM SCORE
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className={typeStyles.label} style={{ marginBottom: '12px' }}>
            RISK / STABILITY LEVEL
          </div>
          <div className="heading-sm" style={{ fontSize: '22px', color: riskState.tone, marginBottom: '10px' }}>
            {riskState.label}
          </div>
          <div className="body" style={{ color: 'rgba(255,255,255,0.54)' }}>
            {weeklyAnalysis?.primaryIssue ? `${weeklyAnalysis.primaryIssue} remains the dominant pressure.` : 'No critical fault path detected.'}
          </div>
        </div>
      </SystemSurface>

      <SystemSurface as="section" variant="elevated" delay={dashboardSequence.cards} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '18px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
              METRIC TIMELINE
            </div>
            <div className="body" style={{ color: 'rgba(255,255,255,0.56)' }}>
              {timelineSummary}
            </div>
          </div>
          {hoveredGraphPoint && (
            <div className="font-mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.72)' }}>
              {hoveredGraphPoint.date} | FOCUS {hoveredGraphPoint.focus} | OUTPUT {hoveredGraphPoint.output}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', minWidth: '720px', height: '280px', display: 'block' }}>
            {[0.25, 0.5, 0.75].map(level => (
              <line
                key={level}
                x1={graphPadding}
                x2={graphWidth - graphPadding}
                y1={graphHeight - graphPadding - level * (graphHeight - graphPadding * 2)}
                y2={graphHeight - graphPadding - level * (graphHeight - graphPadding * 2)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            ))}

            <motion.path
              d={focusPath}
              fill="none"
              stroke="rgba(170,225,196,0.92)"
              strokeWidth="2.4"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ ...motionTiming.slow, delay: dashboardSequence.cards + 0.08 }}
            />
            <motion.path
              d={outputPath}
              fill="none"
              stroke="rgba(255,255,255,0.82)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ ...motionTiming.slow, delay: dashboardSequence.cards + 0.14 }}
            />

            {focusPoints.map((point, index) => (
              <g key={`focus-${index}`} onMouseEnter={() => setHoveredPointIndex(index)} onMouseLeave={() => setHoveredPointIndex(null)}>
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPointIndex === index ? 4 : 2.8}
                  fill="rgba(170,225,196,0.98)"
                  animate={{ opacity: hoveredPointIndex === null || hoveredPointIndex === index ? 1 : 0.58 }}
                  transition={motionConfig.fast}
                />
              </g>
            ))}
            {outputPoints.map((point, index) => (
              <g key={`output-${index}`} onMouseEnter={() => setHoveredPointIndex(index)} onMouseLeave={() => setHoveredPointIndex(null)}>
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPointIndex === index ? 4 : 2.6}
                  fill="rgba(255,255,255,0.92)"
                  animate={{ opacity: hoveredPointIndex === null || hoveredPointIndex === index ? 1 : 0.58 }}
                  transition={motionConfig.fast}
                />
              </g>
            ))}

            {graphSeries.map((point, index) => {
              const x = graphPadding + (index * (graphWidth - graphPadding * 2)) / Math.max(graphSeries.length - 1, 1);
              return (
                <text
                  key={`label-${point.date}`}
                  x={x}
                  y={graphHeight - 6}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.34)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em' }}
                >
                  {point.date}
                </text>
              );
            })}
          </svg>
        </div>
      </SystemSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <SystemSurface as="section" variant="elevated" delay={dashboardSequence.hud}>
          <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
            CAUSATION SIGNAL
          </div>
          <div className="body" style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.56)' }}>
            Detected drivers of performance change
          </div>

          <div
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.018)',
            }}
          >
            <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
              PREDICTED STATE
            </div>
            <div className="body" style={{ marginBottom: '12px', color: 'rgba(255,255,255,0.56)' }}>
              Forward signal from current conditions
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div className="metric-number-sm" style={{ color: 'rgba(255,255,255,0.94)', minWidth: '72px' }}>
                <AnimatedMetric value={prediction.expectedScore} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '220px' }}>
                {predictionStatements.map((statement, index) => (
                  <motion.div
                    key={`prediction-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...motionConfig.smooth, delay: dashboardSequence.hud + 0.06 + index * 0.05 }}
                    className="body"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    {statement}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {causationRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {causationRows.map((chain, chainIndex) => (
                <motion.div
                  key={`chain-${chainIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionConfig.smooth, delay: dashboardSequence.hud + 0.06 + chainIndex * 0.06 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {chain.map((row, index) => (
                    <motion.div
                      key={`${row.node}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...motionConfig.smooth, delay: dashboardSequence.hud + 0.1 + index * 0.05 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                    >
                      <motion.div
                        whileHover={{ opacity: 1, backgroundColor: `rgba(255,255,255,${0.04 + index * 0.02})` }}
                        transition={motionConfig.fast}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: `rgba(255,255,255,${0.02 + index * 0.02})`,
                          opacity: 0.62 + index * 0.12,
                        }}
                      >
                        <span className="font-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
                          {formatSignalLabel(row.node)}
                        </span>
                        <span className="font-mono" style={{ fontSize: '12px', letterSpacing: '0.12em', color: row.relation?.impact && row.relation.impact < 0 ? 'rgba(255,170,170,0.9)' : 'rgba(180,230,198,0.9)' }}>
                          {row.relation ? `${row.relation.impact > 0 ? '+' : ''}${row.relation.impact}%` : 'LOCKED'}
                        </span>
                      </motion.div>
                      {row.relation && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ ...motionConfig.fast, delay: dashboardSequence.hud + 0.12 + index * 0.05 }}
                          style={{ display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', fontSize: '11px' }}
                        >
                          {'-> '}
                          {formatSignalLabel(row.relation.effect)}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
              System is still learning. More completed days are needed before causal chains lock.
            </div>
          )}
        </SystemSurface>

        <SystemSurface as="section" variant="elevated" delay={dashboardSequence.hud + 0.08}>
          <div className={typeStyles.label} style={{ marginBottom: '8px' }}>
            PATTERN MEMORY
          </div>
          <div className="body" style={{ marginBottom: '18px', color: 'rgba(255,255,255,0.56)' }}>
            Time-linked behavior signatures
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {patternMemory.length > 0 ? (
              patternMemory.map((line, index) => (
                <motion.div
                  key={`pattern-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionConfig.smooth, delay: dashboardSequence.hud + 0.12 + index * 0.05 }}
                  whileHover={{ opacity: 1 }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.018)',
                    opacity: 0.82,
                  }}
                >
                  <span className="body" style={{ color: 'rgba(255,255,255,0.72)' }}>
                    {line}
                  </span>
                </motion.div>
              ))
            ) : (
              <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
                Pattern memory will sharpen as the system accumulates more completed days.
              </div>
            )}
          </div>
        </SystemSurface>
      </div>

      <SystemSurface as="section" variant="elevated" delay={dashboardSequence.footer}>
        <div className={typeStyles.label} style={{ marginBottom: '18px' }}>
          SYSTEM INSIGHTS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {systemInsights.length > 0 ? (
            systemInsights.map((insight, index) => (
              <motion.div
                key={`insight-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...motionConfig.smooth, delay: dashboardSequence.footer + 0.04 + index * 0.04 }}
                whileHover={{ opacity: 1 }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.018)',
                  opacity: 0.84,
                }}
              >
                <span className="body" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {insight}
                </span>
              </motion.div>
            ))
          ) : (
            <div className="body" style={{ color: 'rgba(255,255,255,0.48)' }}>
              System insights will populate after more completed logs are available.
            </div>
          )}
        </div>
      </SystemSurface>
    </motion.div>
  );
}
