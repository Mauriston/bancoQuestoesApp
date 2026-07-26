import React, { useState } from 'react';
import { Bookmark, Trash2, Search, Lightbulb, Edit3, CheckCircle2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { SavedQuestion } from '../types';

interface SavedQuestionsViewProps {
  savedQuestions: SavedQuestion[];
  onRemoveSavedQuestion: (questionId: string) => void;
  onUpdateNotes: (questionId: string, notes: string) => void;
}

export const SavedQuestionsView: React.FC<SavedQuestionsViewProps> = ({
  savedQuestions,
  onRemoveSavedQuestion,
  onUpdateNotes
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const startEditNotes = (sq: SavedQuestion) => {
    setEditingId(sq.question.id);
    setEditingNotesText(sq.notes || '');
  };

  const saveNotes = (id: string) => {
    onUpdateNotes(id, editingNotesText);
    setEditingId(null);
  };

  const filtered = savedQuestions.filter(sq => 
    (sq.question.enunciado || sq.question.statement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sq.question.area || sq.question.areaName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sq.question.tema || sq.question.themeName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Bookmark className="w-4 h-4 fill-current" />
              <span>Caderno de Revisão Pessoal</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white font-outfit">
              Caderno de Erros & Questões Salvas
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Guarde questões desafiadoras e revise os comentários e anotações cirúrgicas.
            </p>
          </div>

          <div className="bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 text-center shrink-0">
            <span className="text-xs text-slate-400 block">Total Guardadas</span>
            <span className="text-xl font-bold text-amber-400 font-outfit">
              {savedQuestions.length} questões
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 pt-4 border-t border-slate-800 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar no caderno de erros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Questions list */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Nenhuma questão salva no caderno</h3>
          <p className="text-xs text-slate-500 mt-1">
            Enquanto resolve os simulados, clique em "Salvar Questão" para criar seu caderno de erros e revisões.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((sq) => {
            const q = sq.question;
            const isExpanded = expandedIds[q.id];
            const isEditing = editingId === q.id;

            return (
              <div
                key={q.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition shadow-lg"
              >
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-5 flex items-start justify-between cursor-pointer hover:bg-slate-850 transition select-none"
                >
                  <div className="space-y-2 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
                        {q.area}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-teal-500/10 text-teal-300 text-xs font-medium border border-teal-500/20">
                        {q.tema}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-100 leading-relaxed line-clamp-2">
                      {q.enunciado}
                    </p>

                    {sq.notes && (
                      <p className="text-xs text-amber-300 italic flex items-center space-x-1">
                        <span>📝 Anotação:</span>
                        <span>"{sq.notes}"</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSavedQuestion(q.id);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Remover do caderno"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="p-2 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-800 bg-slate-950/80 space-y-4 text-xs">
                    <p className="text-slate-200 text-sm font-sans">{q.enunciado}</p>

                    <div className="space-y-1.5">
                      {(q.opcoes || []).map((op, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border ${
                            idx === q.respostaCorreta
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}. {op}
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                        <Lightbulb className="w-4 h-4" />
                        <span>Gabarito Comentado SBOT:</span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">{q.explicacao}</p>
                    </div>

                    {/* Notes Section */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNotesText}
                            onChange={(e) => setEditingNotesText(e.target.value)}
                            placeholder="Escreva sua anotação pessoal de revisão para esta questão..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => saveNotes(q.id)}
                              className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                            >
                              Salvar Anotação
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-slate-400">
                          <p className="text-xs italic">
                            {sq.notes ? `Anotação: "${sq.notes}"` : 'Nenhuma anotação adicionada.'}
                          </p>
                          <button
                            onClick={() => startEditNotes(sq)}
                            className="text-amber-400 hover:underline text-xs flex items-center space-x-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{sq.notes ? 'Editar' : 'Adicionar Anotação'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
