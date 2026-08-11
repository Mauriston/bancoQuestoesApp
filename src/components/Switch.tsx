import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

// Switch on/off reutilizável (ex.: "Mostrar apenas selecionadas" na seleção
// de questões de uma prova) — não existia nenhum toggle no app ainda, só
// checkboxes e selects.
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label className={`inline-flex items-center gap-2 select-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors border ${
          checked ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
      {label && <span className="text-xs font-medium text-slate-300">{label}</span>}
    </label>
  );
};
