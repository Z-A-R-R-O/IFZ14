import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuggestionStore } from '../stores/suggestionStore';

interface SmartInputProps {
  value: string;
  onChange: (value: string) => void;
  category: string;
  placeholder?: string;
}

export default function SmartInput({ value, onChange, category, placeholder = 'Enter task...' }: SmartInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const getSuggestions = useSuggestionStore((s) => s.getSuggestions);
  const addSuggestion = useSuggestionStore((s) => s.addSuggestion);

  const suggestions = editing ? getSuggestions(category, draft) : [];
  const hasExactMatch = suggestions.some((s) => s.toLowerCase() === draft.toLowerCase().trim());
  const showCreate = editing && draft.trim() && !hasExactMatch;

  // Total items in dropdown = suggestions + optional "Create" row
  const totalItems = suggestions.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Reset draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      addSuggestion(category, trimmed);
      onChange(trimmed);
    }
    setEditing(false);
    setActiveIdx(-1);
  }, [addSuggestion, category, onChange]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
    setActiveIdx(-1);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % totalItems);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        commit(suggestions[activeIdx]);
      } else if (activeIdx === suggestions.length && showCreate) {
        commit(draft);
      } else if (draft.trim()) {
        commit(draft);
      }
      return;
    }
  };

  // ─── Chip (display) mode ───
  if (!editing) {
    return (
      <div
        className="smart-chip"
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
      >
        <span className="smart-chip-text">
          {value || placeholder}
        </span>
        <span className="smart-chip-edit">✎</span>
      </div>
    );
  }

  // ─── Edit mode ───
  return (
    <div className="smart-input-wrapper">
      <input
        ref={inputRef}
        className="smart-input"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setActiveIdx(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Small delay to allow click on suggestion
          setTimeout(() => {
            if (draft.trim() && draft !== value) {
              commit(draft);
            } else {
              cancel();
            }
          }, 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            className="smart-suggestions"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s}
                className={`smart-suggestion-item${activeIdx === i ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); commit(s); }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {s}
              </div>
            ))}

            {showCreate && (
              <div
                className={`smart-suggestion-item smart-create${activeIdx === suggestions.length ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); commit(draft); }}
                onMouseEnter={() => setActiveIdx(suggestions.length)}
              >
                Create: <span style={{ color: '#fff' }}>"{draft.trim()}"</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
