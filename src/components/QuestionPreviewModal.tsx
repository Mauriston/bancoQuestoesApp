import React from 'react';
import { X } from 'lucide-react';
import { Question, ExamQuestion } from '../types';
import { QuestionImage } from './QuestionImage';

interface QuestionPreviewModalProps {
  question: Question | ExamQuestion;
  onClose: () => void;
}

// Pré-visualização administrativa de uma questão, exatamente no mesmo
// layout usado pelo candidato durante a execução da prova (sem gabarito).
// Usada em QuestionsPage, CreateExamPage e ExamViewPage.
export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({ question, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
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

        <div className="p-6">
          <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
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
