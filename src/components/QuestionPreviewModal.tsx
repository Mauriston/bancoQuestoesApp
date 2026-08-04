import React, { useEffect, useState } from 'react';
import { X, FileCheck } from 'lucide-react';
import { Question, ExamQuestion } from '../types';
import { QuestionImage } from './QuestionImage';
import { getExamsContainingQuestion } from '../services/firebaseService';

interface QuestionPreviewModalProps {
  question: Question | ExamQuestion;
  onClose: () => void;
}

// Pré-visualização administrativa de uma questão, exatamente no mesmo
// layout usado pelo candidato durante a execução da prova (sem gabarito).
// Usada em QuestionsPage e CreateExamPage.
export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({ question, onClose }) => {
  // `ExamQuestion` (cópia congelada dentro de exams/{id}/questions) guarda o
  // id da questão original em `originalQuestionId`; `Question` (banco de
  // questões) já É a questão original, então seu próprio `id` serve de busca.
  const originalQuestionId = 'originalQuestionId' in question ? question.originalQuestionId : question.id;

  const [examsUsedIn, setExamsUsedIn] = useState<{ examId: string; examName: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    getExamsContainingQuestion(originalQuestionId)
      .then(res => { if (!cancelled) setExamsUsedIn(res); })
      .catch(err => console.error("Erro ao buscar provas que usam esta questão:", err));
    return () => { cancelled = true; };
  }, [originalQuestionId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl lg:max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sticky top-0 bg-slate-900 z-10">
          <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg">
            Pré-visualização da Questão
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-[#050f41]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {examsUsedIn.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-6 pt-4">
            <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Já utilizada em:</span>
            {examsUsedIn.map(e => (
              <span
                key={e.examId}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
              >
                <FileCheck className="w-3 h-3" />
                {e.examName}
              </span>
            ))}
          </div>
        )}

        <div className="p-6">
          <p className="text-sm sm:text-base lg:text-lg font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
            {question.statement}
          </p>

          {question.imageUrl && <QuestionImage src={question.imageUrl} allowZoom={false} />}

          <div className="space-y-3 mt-2">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const text = question.alternatives[letter];
              if (!text) return null;
              return (
                <div
                  key={letter}
                  className="w-full p-4 rounded-xl border text-left flex items-start gap-3.5 bg-slate-950/80 border-slate-800 text-slate-300"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 bg-slate-800 text-slate-400 border border-slate-700">
                    {letter}
                  </div>
                  <span className="text-xs sm:text-sm leading-relaxed font-normal flex-1">{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
