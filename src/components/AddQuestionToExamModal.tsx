import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, FileCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getEditableExams, addQuestionToExam } from '../services/firebaseService';
import { Exam, Question } from '../types';

interface Props {
  question: Question;
  onClose: () => void;
}

// Modal para inserir uma questão do banco em uma prova existente. O campo
// de pesquisa é um autocomplete que só lista provas com edição habilitada
// (inativas e sem tentativas — ver getEditableExams).
export const AddQuestionToExamModal: React.FC<Props> = ({ question, onClose }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exam | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getEditableExams()
      .then(setExams)
      .catch(err => setError('Erro ao carregar provas: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exams.filter(e => !term || e.name.toLowerCase().includes(term));
  }, [exams, search]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await addQuestionToExam(selected.id, question);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" />
            Inserir questão em uma prova
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-slate-400 line-clamp-2">{question.statement}</p>

        {done ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Questão inserida em “{selected?.name}”.</span>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-xl">Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative" ref={containerRef}>
              <label className="block text-slate-300 font-medium mb-1">Prova *</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  placeholder={loading ? 'Carregando provas...' : 'Pesquisar prova pelo nome...'}
                  value={search}
                  disabled={loading}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null); setListOpen(true); }}
                  onFocus={() => setListOpen(true)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 disabled:opacity-60"
                />
              </div>
              {listOpen && !loading && (
                <div className="absolute z-10 mt-1.5 w-full max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1">
                  {matches.length === 0 ? (
                    <p className="px-3 py-2 text-slate-500">
                      {exams.length === 0 ? 'Nenhuma prova com edição habilitada (inativa e sem tentativas).' : 'Nenhuma prova encontrada.'}
                    </p>
                  ) : matches.map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { setSelected(e); setSearch(e.name); setListOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{e.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{e.questionCount ?? 0} questões</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">Cancelar</button>
              <button
                onClick={handleConfirm}
                disabled={!selected || saving}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-xl disabled:opacity-40"
              >
                {saving ? 'Inserindo...' : 'Inserir na prova'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
