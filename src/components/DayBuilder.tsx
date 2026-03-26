import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutoDayPrefillValues, DayTemplate, DayBlock, CustomInputType } from '../types';
import { useDailyStore, BUILTIN_TEMPLATES } from '../stores/dailyStore';
import { useAutoDayStore } from '../stores/autoDayStore';
import { normalizeModeName } from '../lib/modeName';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * DayBuilder — MANUAL template picker / editor.
 * Role: Architecture layer. Lets user choose or build a structure.
 * Does NOT auto-generate. That's the AutoDayEngine's job.
 */

interface DayBuilderProps {
  onComplete: (template: DayTemplate, modeName: string, preFilledValues: AutoDayPrefillValues) => void;
  onCancel?: () => void;
}

const BLOCK_TYPES: { type: DayBlock['type']; label: string }[] = [
  { type: 'wake', label: 'WAKE' },
  { type: 'body', label: 'BODY' },
  { type: 'deep_work', label: 'DEEP WORK' },
  { type: 'production', label: 'PRODUCTION' },
  { type: 'reflection', label: 'REFLECTION' },
  { type: 'custom', label: 'CUSTOM' },
];

function formatBlockLabel(title: string) {
  return title
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function describeFlow(blocks: DayTemplate) {
  return blocks.map((block) => formatBlockLabel(block.title)).join(' -> ');
}

function SortableBuilderBlock({ block, index, onRemove }: { block: DayBlock, index: number, onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '8px',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style as any}
      animate={{ scale: isDragging ? 1.03 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div {...attributes} {...listeners} style={{ color: '#555', cursor: 'grab', padding: '4px' }}>⋮⋮</div>
        <span className="text-meta">{String(index + 1).padStart(2, '0')}</span>
        <span style={{ fontSize: '13px', letterSpacing: '0.08em', color: '#fff' }}>{block.title}</span>
        {block.type === 'deep_work' && (
          <span style={{ fontSize: '10px', color: '#555' }}>({block.dwCount} sessions)</span>
        )}
        {block.type === 'custom' && (
          <span style={{ fontSize: '10px', color: '#555', border: '1px solid #333', padding: '2px 6px', borderRadius: '4px' }}>
            {block.customType}
          </span>
        )}
      </div>
      <button
        onClick={() => onRemove(block.id)}
        style={{ background: 'none', border: 'none', color: '#444', fontSize: '14px', cursor: 'pointer', padding: '2px 6px', transition: 'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = '#444'}
      >
        ×
      </button>
    </motion.div>
  );
}


export default function DayBuilder({ onComplete, onCancel }: DayBuilderProps) {
  const customTemplates = useDailyStore(s => s.customTemplates);
  const allTemplates = [
    ...Object.values(BUILTIN_TEMPLATES),
    ...customTemplates,
  ];

  const { builderData, reset: resetAutoDay } = useAutoDayStore();
  const isAutoEdit = !!builderData;

  const [view, setView] = useState<'pick' | 'custom'>(isAutoEdit ? 'custom' : 'pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customBlocks, setCustomBlocks] = useState<DayTemplate>([]);
  const [customName, setCustomName] = useState('CUSTOM');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Custom block modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomType, setNewCustomType] = useState<CustomInputType>('toggle');
  const [newCustomWeight, setNewCustomWeight] = useState(1.0);

  // ─── Hydration ───
  useEffect(() => {
    if (builderData) {
      setCustomBlocks(JSON.parse(JSON.stringify(builderData.template)));
      setCustomName(normalizeModeName(builderData.modeName));
      setView('custom');
    }
  }, [builderData]);

  // ─── Pick a template ───
  const handlePickTemplate = (id: string) => {
    setSelectedId(id);
  };

  const handleConfirmTemplate = () => {
    const tpl = allTemplates.find(t => t.id === selectedId);
    if (!tpl) return;
    onComplete(tpl.structure, tpl.name, {});
    if (isAutoEdit) resetAutoDay();
  };

  // ─── Custom builder ───
  const addBlock = (type: DayBlock['type']) => {
    const ts = Date.now();
    const block: DayBlock = {
      id: `block-${ts}`,
      type,
      title: type.replace('_', ' ').toUpperCase(),
      weight: 1.0,
    };
    if (type === 'deep_work') block.dwCount = 2;
    if (type === 'custom') {
      setShowCustomModal(true);
      return; // Don't add until modal completes
    }
    setCustomBlocks(prev => [...prev, block]);
  };

  const handleCreateCustomBlock = () => {
    if (!newCustomName) return;
    const ts = Date.now();
    const block: DayBlock = {
      id: `custom-${ts}`,
      type: 'custom',
      title: newCustomName.toUpperCase(),
      customType: newCustomType,
      weight: newCustomWeight,
    };
    setCustomBlocks(prev => [...prev, block]);
    setShowCustomModal(false);
    setNewCustomName('');
    setNewCustomType('toggle');
    setNewCustomWeight(1.0);
  };

  const removeBlock = (id: string) => {
    setCustomBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleConfirmCustom = () => {
    if (customBlocks.length === 0) return;
    const normalizedModeName = normalizeModeName(customName);
    
    // Pass along prefilled values if we are editing auto-day
    const preFilled: AutoDayPrefillValues = isAutoEdit ? {
      wake: builderData.preFilled.wake,
      body: builderData.preFilled.body,
      deepWork: { sessions: builderData.deepWorkSessions },
      production: { target: builderData.productionTarget },
      custom: builderData.preFilled.custom || {}
    } : {};
    
    onComplete(customBlocks, normalizedModeName, preFilled);
    if (isAutoEdit) resetAutoDay();
  };

  // ─── Drag & Drop ───
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (active.id !== over?.id && over) {
      setCustomBlocks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const activeBlock = customBlocks.find(b => b.id === activeDragId);

  return (
    <div className="daybuilder-shell" style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px', overflowY: 'auto' }}>
      <div className="daybuilder-panel" style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '48px auto', padding: '24px 28px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', background: 'rgba(8,8,8,0.92)' }}>
        {onCancel && (
          <button
            onClick={onCancel}
            className="daybuilder-close-btn"
            aria-label="Close builder"
            style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', letterSpacing: '0.1em', cursor: 'pointer' }}
          >
            <span className="daybuilder-close-icon">×</span>
          </button>
        )}
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="wizard-label" style={{ marginBottom: '12px' }}>
            SYSTEM STRUCTURE
          </div>
          <div className="heading-sm" style={{ fontSize: '32px', fontWeight: 500, color: '#fff', letterSpacing: '0.01em' }}>
            {isAutoEdit ? builderData.modeName : 'Configure how your day executes'}
          </div>
          <div className="body" style={{ marginTop: '10px', color: 'rgba(255,255,255,0.5)' }}>
            {view === 'pick' ? 'Select the execution pattern.' : 'Build the execution pipeline.'}
          </div>
        </div>

        {/* View Tabs */}
        <div className="daybuilder-tabs" style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '32px' }}>
          <button
            onClick={() => setView('pick')}
            className={`daybuilder-tab ${view === 'pick' ? 'is-active' : ''}`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', letterSpacing: '0.15em',
              color: view === 'pick' ? '#fff' : '#555',
              borderBottom: view === 'pick' ? '1px solid #fff' : '1px solid transparent',
              paddingBottom: '4px', transition: 'all 0.2s ease',
            }}
          >
            TEMPLATES
          </button>
          <button
            onClick={() => setView('custom')}
            className={`daybuilder-tab ${view === 'custom' ? 'is-active' : ''}`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', letterSpacing: '0.15em',
              color: view === 'custom' ? '#fff' : '#555',
              borderBottom: view === 'custom' ? '1px solid #fff' : '1px solid transparent',
              paddingBottom: '4px', transition: 'all 0.2s ease',
            }}
          >
            CUSTOM
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ─── TEMPLATE PICKER ─── */}
          {view === 'pick' && (
            <motion.div
              key="pick"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {allTemplates.map((tpl) => {
                const isSelected = selectedId === tpl.id;
                return (
                  <motion.button
                    key={tpl.id}
                    onClick={() => handlePickTemplate(tpl.id)}
                    whileHover={{ scale: isSelected ? 1.02 : 1.01 }}
                    className={`daybuilder-template-card ${isSelected ? 'is-selected' : ''}`}
                    style={{
                      padding: '20px 24px',
                      background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.018)',
                      border: isSelected ? '1px solid rgba(255,255,255,0.24)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 18px rgba(255,255,255,0.06)' : 'none',
                      opacity: isSelected ? 1 : 0.78,
                      width: '100%',
                    }}
                  >
                    <div style={{ fontSize: '14px', letterSpacing: '0.08em', color: '#fff', fontWeight: 600 }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.34)', marginTop: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      Flow
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.58)', marginTop: '6px', letterSpacing: '0.04em', lineHeight: 1.5 }}>
                      {describeFlow(tpl.structure)}
                    </div>
                    {tpl.type === 'custom' && (
                      <div style={{ fontSize: '9px', color: '#444', marginTop: '4px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CUSTOM</div>
                    )}
                  </motion.button>
                );
              })}

              {selectedId && (
                <div className="daybuilder-template-preview" style={{ padding: '12px 0 0', color: 'rgba(255,255,255,0.48)' }}>
                  <span className="wizard-label" style={{ display: 'block', marginBottom: '8px' }}>Today Will Run</span>
                  <span className="body">
                    {describeFlow(allTemplates.find((tpl) => tpl.id === selectedId)?.structure || [])}
                  </span>
                </div>
              )}

              {/* Confirm */}
              <button
                onClick={handleConfirmTemplate}
                disabled={!selectedId}
                className={`daybuilder-apply-btn ${selectedId ? 'is-active' : 'is-disabled'}`}
                style={{
                  marginTop: '24px', padding: '16px', width: '100%',
                  background: selectedId ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.05)',
                  color: selectedId ? '#000' : '#555',
                  border: '1px solid transparent', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em',
                  cursor: selectedId ? 'pointer' : 'default',
                  transition: 'all 0.2s ease', textTransform: 'uppercase',
                }}
              >
                APPLY STRUCTURE
              </button>
            </motion.div>
          )}

          {/* ─── CUSTOM BUILDER ─── */}
          {view === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Name */}
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="MODE NAME"
                maxLength={12}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '16px', letterSpacing: '0.06em',
                  padding: '8px 0', outline: 'none', width: '100%',
                  fontFamily: 'inherit',
                }}
              />

              <div className="daybuilder-flow-preview">
                <div className="wizard-label" style={{ marginBottom: '10px' }}>Execution Flow</div>
                <div className="body" style={{ color: 'rgba(255,255,255,0.42)', marginBottom: '10px' }}>
                  {formatBlockLabel(normalizeModeName(customName))}
                </div>
                {customBlocks.length === 0 ? (
                  <div className="body" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Add modules below to define the pipeline.
                  </div>
                ) : (
                  <div className="daybuilder-flow-chain">
                    {customBlocks.map((block, idx) => (
                      <div key={block.id} className="daybuilder-flow-node">
                        <span>{block.title}</span>
                        {idx < customBlocks.length - 1 ? <span className="daybuilder-flow-arrow">-&gt;</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {customBlocks.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#444', letterSpacing: '0.08em', textAlign: 'center', padding: '24px' }}>
                    No modules in the pipeline yet
                  </div>
                )}
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={customBlocks} strategy={verticalListSortingStrategy}>
                    {customBlocks.map((block, idx) => (
                      <SortableBuilderBlock key={block.id} block={block} index={idx} onRemove={removeBlock} />
                    ))}
                  </SortableContext>
                  <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                    {activeBlock ? (
                       <SortableBuilderBlock block={activeBlock} index={customBlocks.findIndex(b => b.id === activeDragId)} onRemove={() => {}} />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>

              {/* Add module buttons */}
              <div className="daybuilder-module-chooser" style={{
                padding: '16px', border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center',
              }}>
                {BLOCK_TYPES.map(({ type, label }) => (
                  <motion.button
                    key={type}
                    onClick={() => addBlock(type)}
                    whileHover={{ scale: 1.02, y: -1 }}
                    className="daybuilder-module-btn"
                    style={{
                      padding: '8px 16px', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)', color: '#888',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '10px',
                      letterSpacing: '0.1em', transition: 'all 0.2s', boxShadow: 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    + {label}
                  </motion.button>
                ))}
              </div>

              {/* Confirm */}
              <button
                onClick={handleConfirmCustom}
                disabled={customBlocks.length === 0}
                className={`daybuilder-apply-btn ${customBlocks.length > 0 ? 'is-active' : 'is-disabled'}`}
                style={{
                  marginTop: '16px', padding: '16px', width: '100%',
                  background: customBlocks.length > 0 ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.05)',
                  color: customBlocks.length > 0 ? '#000' : '#555',
                  border: '1px solid transparent', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em',
                  cursor: customBlocks.length > 0 ? 'pointer' : 'default',
                  transition: 'all 0.2s ease', textTransform: 'uppercase',
                }}
              >
                APPLY STRUCTURE
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── CUSTOM BLOCK MODAL ─── */}
        <AnimatePresence>
          {showCustomModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.div
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                style={{ background: '#0a0a0a', border: '1px solid #222', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div style={{ fontSize: '16px', fontWeight: 500, color: '#fff' }}>ADD CUSTOM BLOCK</div>
                
                <div>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>BLOCK NAME</div>
                  <input
                    value={newCustomName} onChange={e => setNewCustomName(e.target.value)}
                    placeholder="e.g., Meditation, Reading"
                    style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', outline: 'none' }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>INPUT TYPE</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['toggle', 'number', 'text'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCustomType(t)}
                        style={{ flex: 1, padding: '10px', background: newCustomType === t ? '#fff' : '#111', color: newCustomType === t ? '#000' : '#888', border: newCustomType === t ? 'none' : '1px solid #333', borderRadius: '6px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>IMPACT WEIGHT (0.0 to 5.0)</div>
                  <input
                    type="number" step="0.1" min="0" max="5"
                    value={newCustomWeight} onChange={e => setNewCustomWeight(parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button onClick={() => setShowCustomModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer' }}>CANCEL</button>
                  <button onClick={handleCreateCustomBlock} disabled={!newCustomName} style={{ flex: 1, padding: '12px', background: '#fff', color: '#000', border: 'none', borderRadius: '8px', cursor: newCustomName ? 'pointer' : 'default', opacity: newCustomName ? 1 : 0.5 }}>CREATE</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
