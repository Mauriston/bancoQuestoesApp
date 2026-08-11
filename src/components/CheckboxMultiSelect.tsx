import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  id: string;
  label: string;
}

interface CheckboxMultiSelectProps {
  label: string;
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Dropdown com caixas de seleção reutilizável para filtros de múltipla
// escolha (Área, Tema...) — mesmo padrão visual/comportamental do dropdown
// de "Fonte da Questão" já existente em QuestionsPage/CreateExamPage,
// generalizado para não precisar duplicar o código em cada página.
export const CheckboxMultiSelect: React.FC<CheckboxMultiSelectProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  emptyLabel,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(v => v !== id) : [...selectedIds, id]);
  };

  const buttonLabel = selectedIds.length === 0
    ? (emptyLabel || `Todos(as) ${label}`)
    : `${selectedIds.length} ${label.toLowerCase()}${selectedIds.length > 1 ? 's' : ''} selecionado${selectedIds.length > 1 ? 's' : ''}`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 flex items-center justify-between gap-2 disabled:opacity-50"
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1.5 w-full min-w-[14rem] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left text-[10px] font-semibold uppercase text-cyan-400 hover:text-cyan-300 px-2 py-1.5"
            >
              Limpar seleção
            </button>
          )}
          {options.length === 0 ? (
            <p className="text-[11px] text-slate-500 px-2 py-1.5 italic">Nenhuma opção disponível.</p>
          ) : (
            options.map(opt => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};
