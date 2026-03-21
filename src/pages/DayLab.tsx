import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDailyStore, BUILTIN_TEMPLATES } from '../stores/dailyStore';
import type { DayBlock, DayTemplate, TemplateDefinition } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableLabBlock({ block, isExpanded, onToggleExpand, onRemove, onUpdate }: { 
  block: DayBlock; 
  isExpanded: boolean; 
  onToggleExpand: () => void;
  onRemove: (id: string, e: React.MouseEvent) => void;
  onUpdate?: (id: string, updates: Partial<DayBlock>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
    border: isExpanded ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px 20px',
    cursor: 'default',
    position: 'relative',
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? '0 16px 32px rgba(0,0,0,0.5)' : 'none',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style as any}
      layoutId={block.id}
      animate={{ scale: isDragging ? 1.02 : 1 }}
      onClick={onToggleExpand}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Drag Handle */}
          <div {...attributes} {...listeners} style={{ color: '#555', cursor: 'grab', padding: '4px' }}>⋮⋮</div>
          <div>
            <div className="text-label" style={{ fontSize: '14px', color: '#FFF' }}>{block.title}</div>
            <div className="text-meta" style={{ marginTop: '4px' }}>
              Type: {block.type} {block.type === 'deep_work' && `(${block.dwCount} sessions)`}
            </div>
          </div>
        </div>
        
        <button onClick={(e) => onRemove(block.id, e)} style={{ background: 'none', border: 'none', color: '#555', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>
          ×
        </button>
      </div>

      {/* Expanded Properties Editor */}
      {isExpanded && onUpdate && (
        <motion.div 
          initial={{ height: 0, opacity: 0, marginTop: 0 }}
          animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
          style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
          onClick={(e) => e.stopPropagation()} // Prevent collapse when interacting with inputs
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#777' }}>DISPLAY LABEL</label>
            <input 
              value={block.title}
              onChange={(e) => onUpdate(block.id, { title: e.target.value })}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', letterSpacing: '0.04em', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#777' }}>SYSTEM WEIGHT ({parseFloat(block.weight?.toString() || '1').toFixed(1)}x)</label>
            <input 
              type="range" min="0" max="3" step="0.1"
              value={block.weight || 1}
              onChange={(e) => onUpdate(block.id, { weight: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#FFF' }}
            />
          </div>

          {block.type === 'deep_work' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="text-meta">SESSIONS COUNT ({block.dwCount})</label>
              <input 
                type="range" min="1" max="8" step="1"
                value={block.dwCount || 2}
                onChange={(e) => onUpdate(block.id, { dwCount: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#FFF' }}
              />
            </div>
          )}

          {block.type === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="text-meta">INPUT TYPE</label>
              <select 
                value={block.customType || 'toggle'}
                onChange={(e) => onUpdate(block.id, { customType: e.target.value as any })}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
              >
                <option value="toggle">Toggle (ON/OFF)</option>
                <option value="number">Number (Metric)</option>
                <option value="text">Notes (Journal)</option>
              </select>
            </div>
          )}

        </motion.div>
      )}
    </motion.div>
  );
}

export default function DayLab() {
  const navigate = useNavigate();
  const getActiveTemplateStructure = useDailyStore(s => s.getActiveTemplateStructure);
  const getActiveTemplateName = useDailyStore(s => s.getActiveTemplateName);
  const saveCustomTemplate = useDailyStore(s => s.saveCustomTemplate);
  const deleteCustomTemplate = useDailyStore(s => s.deleteCustomTemplate);
  const setActiveTemplate = useDailyStore(s => s.setActiveTemplate);
  const customTemplates = useDailyStore(s => s.customTemplates);
  const activeId = useDailyStore(s => s.activeTemplateId);

  // Initialize lab memory from active template or an empty slate
  const initialStructure = getActiveTemplateStructure() || [];
  const initialName = getActiveTemplateName() || 'CUSTOM SYSTEM';
  
  const [templateName, setTemplateName] = useState(initialName.includes('MODE') ? 'NEW SYSTEM' : initialName);
  const [systemType, setSystemType] = useState<TemplateDefinition['systemType']>('custom');
  const [blocks, setBlocks] = useState<DayTemplate>(initialStructure);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setActiveEditorId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (active.id !== over?.id && over) {
      setBlocks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const activeBlock = blocks.find(b => b.id === activeDragId);

  const handleSaveAsTemplate = () => {
    if (blocks.length === 0) return;
    
    // Always create a new template id when saving explicit templates
    const targetId = `custom_${Date.now()}`;

    const newTemplate: TemplateDefinition = {
      id: targetId,
      type: 'custom',
      name: templateName,
      systemType,
      version: Date.now(),
      createdAt: Date.now(),
      structure: blocks,
    };

    saveCustomTemplate(newTemplate);
    setActiveTemplate(targetId);
  };

  const handleDeploy = () => {
    if (blocks.length === 0) return;
    
    // If we branched off a built-in or we want a fresh copy, we generate a new ID
    // Otherwise we update the existing custom template
    let targetId = activeId;
    if (!targetId || targetId === 'execution' || targetId === 'domination' || targetId === 'recovery') {
      targetId = `custom_${Date.now()}`;
    }

    const newTemplate: TemplateDefinition = {
      id: targetId,
      type: 'custom',
      name: templateName,
      systemType,
      version: Date.now(),
      createdAt: Date.now(),
      structure: blocks,
    };

    saveCustomTemplate(newTemplate);
    setActiveTemplate(targetId);
    navigate('/daily');
  };

  const handleApplyTemplate = (tpl: TemplateDefinition) => {
    // ELITE UPGRADE: Immutability. Clone deep and re-uuid to prevent reference mutation loops.
    const clonedBlocks = JSON.parse(JSON.stringify(tpl.structure)).map((b: DayBlock) => ({
      ...b,
      id: `block-${uuidv4()}`
    }));
    setBlocks(clonedBlocks);
    setTemplateName(tpl.name);
    if (tpl.systemType) setSystemType(tpl.systemType);
    setActiveEditorId(null);
  };

  const handleAddBlock = (type: DayBlock['type']) => {
    const newBlock: DayBlock = { 
      id: `block-${uuidv4()}`, 
      type, 
      title: type.replace('_', ' ').toUpperCase(),
      weight: 1.0
    };
    
    if (type === 'custom') newBlock.customType = 'toggle';
    if (type === 'deep_work') newBlock.dwCount = 2;
    
    setBlocks([...blocks, newBlock]);
    setActiveEditorId(newBlock.id);
  };

  const removeBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlocks(blocks.filter(b => b.id !== id));
    if (activeEditorId === id) setActiveEditorId(null);
  };

  const updateBlock = (id: string, updates: Partial<DayBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', padding: '64px 24px', fontFamily: '"Satoshi", sans-serif' }}>
      <div className="ifz14-flow-field" />
      
      <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
          <div>
            <div className="text-section" style={{ marginBottom: '16px' }}>DAY LAB</div>
            <input 
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="SYSTEM NAME"
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)',
                color: '#FFF', fontSize: '24px', letterSpacing: '0.04em', outline: 'none', padding: '8px 0',
                width: '100%', fontFamily: '"Clash Display", sans-serif', fontWeight: 500
              }}
            />
          </div>
          
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', letterSpacing: '0.2em', cursor: 'pointer' }}
          >
            CANCEL
          </button>
        </div>

        {/* Structure Canvas - Drag & Drop */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks} strategy={verticalListSortingStrategy}>
              {blocks.map((block) => (
                <SortableLabBlock 
                  key={block.id} 
                  block={block} 
                  isExpanded={activeEditorId === block.id} 
                  onToggleExpand={() => setActiveEditorId(activeEditorId === block.id ? null : block.id)} 
                  onRemove={removeBlock} 
                  onUpdate={updateBlock} 
                />
              ))}
            </SortableContext>
            
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeBlock ? (
                <SortableLabBlock 
                  block={activeBlock} 
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  onRemove={() => {}} 
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Add Modules Menu */}
        <div style={{ padding: '24px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', textAlign: 'center', marginBottom: '64px' }}>
          <div className="text-section" style={{ marginBottom: '16px' }}>+ ADD MODULE</div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['wake', 'body', 'deep_work', 'production', 'reflection', 'custom'].map(t => (
              <button 
                key={t} onClick={() => handleAddBlock(t as DayBlock['type'])} 
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#AAA', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#FFF'}
                onMouseLeave={e => e.currentTarget.style.color = '#AAA'}
              >
                {t.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Save & Deploy Controls */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '64px' }}>
          <button
            onClick={handleSaveAsTemplate}
            style={{
              flex: 1, padding: '16px', background: 'transparent', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            SAVE TEMPLATE
          </button>
          <button
            onClick={handleDeploy}
            style={{
              flex: 2, padding: '16px', background: '#FFF', color: '#000', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer'
            }}
          >
            DEPLOY SYSTEM
          </button>
        </div>

        {/* ─── TEMPLATES MARKETPLACE ─── */}
        <div style={{ padding: '32px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-section" style={{ marginBottom: '24px' }}>TEMPLATE LIBRARY</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[...Object.values(BUILTIN_TEMPLATES), ...customTemplates].map((tpl: any) => {
              const dwCount = tpl.structure.filter((b: any) => b.type === 'deep_work').reduce((acc: number, b: any) => acc + (b.dwCount || 1), 0);
              const hasGym = tpl.structure.some((b: any) => b.type === 'body');
              const hasRef = tpl.structure.some((b: any) => b.type === 'reflection');
              
              const summary = [
                dwCount > 0 ? `Deep Work x${dwCount}` : '',
                hasGym ? 'Gym' : '',
                hasRef ? 'Reflection' : ''
              ].filter(Boolean).join(' → ');

              const isCustom = tpl.type === 'custom';

              return (
                <div key={tpl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', color: '#FFF', letterSpacing: '0.04em', fontWeight: 500 }}>{tpl.name}</span>
                      <span style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid #333', borderRadius: '4px', color: '#888', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        {tpl.systemType || 'BALANCED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', letterSpacing: '0.04em' }}>
                      {summary || 'Custom Structure'}
                    </div>
                    {isCustom && (
                      <div style={{ fontSize: '10px', color: '#444', marginTop: '6px' }}>
                        Version {tpl.version ? new Date(tpl.version).toLocaleDateString() : 'Legacy'}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {isCustom && (
                      <button 
                        onClick={() => deleteCustomTemplate(tpl.id)}
                        style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,0,0,0.3)', color: '#FF4444', borderRadius: '6px', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer' }}
                      >
                        DELETE
                      </button>
                    )}
                    <button 
                      onClick={() => handleApplyTemplate(tpl)}
                      style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', borderRadius: '6px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                      APPLY
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
