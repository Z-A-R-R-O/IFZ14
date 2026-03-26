import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, subDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useDailyStore } from '../../../stores/dailyStore';
import { useAutoDayStore } from '../../../stores/autoDayStore';
import { useTaskStore } from '../../../stores/taskStore';
import { calculateScore, hasScoreEvidence } from '../../../engines/scoreEngine';
import { detectPattern } from '../../../engines/patternEngine';
import type { DailyEntry } from '../../../types';
import { createEmptyEntry } from '../../../types';
import { normalizeModeName } from '../../../lib/modeName';
import { useDebounce } from '../components/DailyPrimitives';

type UseDailyPageModelArgs = {
  urlDate: string | null;
};

export function useDailyPageModel({ urlDate }: UseDailyPageModelArgs) {
  const [selectedDate, setSelectedDate] = useState(urlDate || format(new Date(), 'yyyy-MM-dd'));
  const entries = useDailyStore((s) => s.entries);
  const tasks = useTaskStore((s) => s.tasks);
  const updateEntry = useDailyStore((s) => s.updateEntry);
  const completeEntry = useDailyStore((s) => s.completeEntry);
  const getActiveTemplateStructure = useDailyStore((s) => s.getActiveTemplateStructure);
  const getActiveTemplateName = useDailyStore((s) => s.getActiveTemplateName);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isAutoDayOpen, setIsAutoDayOpen] = useState(false);
  const builderData = useAutoDayStore((s) => s.builderData);
  const resetAutoDay = useAutoDayStore((s) => s.reset);

  useEffect(() => {
    if (urlDate && urlDate !== selectedDate) setSelectedDate(urlDate);
  }, [urlDate, selectedDate]);

  const dayTemplate = getActiveTemplateStructure() || [];
  const entry = useMemo(() => entries[selectedDate] || createEmptyEntry(selectedDate, dayTemplate), [entries, selectedDate, dayTemplate]);
  const activeTemplate = entry.structure_snapshot && entry.structure_snapshot.length > 0 ? entry.structure_snapshot : dayTemplate;

  const resolvedModeName = useMemo(() => {
    const entryMode = entry.dynamic_values?.modeName;
    if (entryMode) return normalizeModeName(entryMode);
    const activeTemplateName = getActiveTemplateName();
    if (activeTemplateName && activeTemplateName !== 'UNKNOWN SYSTEM') return normalizeModeName(activeTemplateName, { defaultName: 'EXECUTION MODE' });
    return 'BUILD MODE';
  }, [entry.dynamic_values?.modeName, getActiveTemplateName]);

  useEffect(() => {
    if (!entries[selectedDate]) updateEntry(selectedDate, { structure_snapshot: dayTemplate });
  }, [selectedDate, entries, updateEntry, dayTemplate]);

  const mode = entry.dynamic_values?.modeName;
  const isBlank = !entry.isBuilt || !mode;

  useEffect(() => {
    if (isBlank && !isBuilderOpen) setIsAutoDayOpen(true);
    else if (!isBlank) setIsAutoDayOpen(false);
  }, [selectedDate, isBlank, isBuilderOpen]);

  useEffect(() => {
    return () => {
      useAutoDayStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (builderData) {
      setIsAutoDayOpen(false);
      setIsBuilderOpen(true);
    }
  }, [builderData]);

  const handleOpenBuilder = () => {
    setIsAutoDayOpen(false);
    setIsBuilderOpen(true);
  };

  const handleOpenAutoDay = () => {
    setIsBuilderOpen(false);
    resetAutoDay();
    setIsAutoDayOpen(true);
  };

  const shiftDay = useCallback((direction: -1 | 1) => {
    const current = new Date(selectedDate);
    const next = direction === -1 ? subDays(current, 1) : addDays(current, 1);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  }, [selectedDate]);

  const [saveStatus, setSaveStatus] = useState('');
  const save = useCallback((updates: Partial<DailyEntry>) => {
    updateEntry(selectedDate, updates);
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(''), 1500);
  }, [selectedDate, updateEntry]);

  const debouncedSave = useDebounce((updates: unknown) => save(updates as Partial<DailyEntry>), 500);

  const update = useCallback((updates: Partial<DailyEntry>) => {
    updateEntry(selectedDate, updates);
    debouncedSave(updates);
  }, [selectedDate, updateEntry, debouncedSave]);

  const liveScore = useMemo(() => {
    try { return calculateScore(entry); } catch { return { score: 0, state: 'STABLE' as const }; }
  }, [entry]);

  const allCompleted = useMemo(() => (Object.values(entries) as DailyEntry[]).filter((value) => value.completed).sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const pattern = useMemo(() => detectPattern(allCompleted), [allCompleted]);

  const hasMinData = hasScoreEvidence(entry);
  useEffect(() => {
    if (hasMinData && !entry.completed) {
      const timer = setTimeout(() => completeEntry(selectedDate), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasMinData, entry.completed, selectedDate, completeEntry]);

  const removeSection = (index: number) => {
    const newStructure = activeTemplate.filter((_, i) => i !== index);
    update({ structure_snapshot: newStructure });
  };

  const duplicateSection = (index: number) => {
    const newStructure = [...activeTemplate];
    newStructure.splice(index + 1, 0, { ...activeTemplate[index], id: uuidv4() });
    update({ structure_snapshot: newStructure });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newStructure = [...activeTemplate];
    const [removed] = newStructure.splice(index, 1);
    if (direction === 'up' && index > 0) newStructure.splice(index - 1, 0, removed);
    else if (direction === 'down' && index < newStructure.length) newStructure.splice(index + 1, 0, removed);
    update({ structure_snapshot: newStructure });
  };

  const visual = useMemo(() => ({ border: 0.08 }), []);

  return {
    activeTemplate,
    dayTemplate,
    duplicateSection,
    entries,
    entry,
    handleOpenAutoDay,
    handleOpenBuilder,
    isAutoDayOpen,
    isBlank,
    isBuilderOpen,
    isPanelOpen,
    liveScore,
    moveSection,
    pattern,
    removeSection,
    resolvedModeName,
    saveStatus,
    selectedDate,
    setIsAutoDayOpen,
    setIsBuilderOpen,
    setIsPanelOpen,
    setSelectedDate,
    shiftDay,
    tasks,
    update,
    visual,
  };
}
