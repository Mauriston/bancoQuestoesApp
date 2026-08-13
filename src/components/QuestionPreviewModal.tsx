import React, { useEffect, useState } from 'react';
import { X, FileCheck, CheckCircle2, Copy, Check, ChevronDown } from 'lucide-react';
import { Question, ExamQuestion, QuestionAnswer, Reference } from '../types';
import { QuestionImage } from './QuestionImage';
import { CommentMedia } from './CommentMedia';
import { ReferenceSource } from './ReferenceSource';
import { getExamsContainingQuestion, getQuestionAnswer, getReferences } from '../services/firebaseService';

interface QuestionPreviewModalProps {
  question: Question | ExamQuestion;
  onClose: () => void;
}

// Pré-visualização administrativa de uma questão — ao contrário da mesma
// tela no fluxo do candidato, aqui o gabarito é exibido de propósito
// (alternativa correta destacada + comentário), já que só o admin acessa
// esta modal. Usada em QuestionsPage e CreateExamPage.
export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({ question, onClose }) => {
  // `ExamQuestion` (cópia congelada dentro de exams/{id}/questions) guarda o
  // id da questão original em `originalQuestionId`; `Question` (banco de
  // questões) já É a questão original, então seu próprio `id` serve de busca.
  const originalQuestionId = 'originalQuestionId' in question ? question.originalQuestionId : question.id;

  const [examsUsedIn, setExamsUsedIn] = useState<{ examId: string; examName: string }[]>([]);
  const [answer, setAnswer] = useState<QuestionAnswer | null>(null);
  const [copied, setCopied] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(originalQuestionId)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(err => console.error("Erro ao copiar id da questão:", err));
  };

  useEffect(() => {
    let cancelled = false;
    getExamsContainingQuestion(originalQuestionId)
      .then(res => { if (!cancelled) setExamsUsedIn(res); })
      .catch(err => console.error("Erro ao buscar provas que usam esta questão:", err));
    getQuestionAnswer(originalQuestionId)
      .then(res => { if (!cancelled) setAnswer(res); })
      .catch(err => console.error("Erro ao buscar gabarito da questão:", err));
    getReferences()
      .then(res => { if (!cancelled) setReferences(res); })
      .catch(err => console.error("Erro ao buscar referências:", err));
    return () => { cancelled = true; };
  }, [originalQuestionId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center p-4"
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-6 pt-3 text-[10px] text-slate-500">
          <span className="font-mono truncate">ID: {originalQuestionId}</span>
          <button
            type="button"
            onClick={handleCopyId}
            title="Copiar ID para a área de transferência"
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {examsUsedIn.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-6 pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Já utilizada em:</span>
            {examsUsedIn.map(e => (
              <span
                key={e.examId}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30"
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
              const isCorrect = answer?.correctAlternative === letter;
              return (
                <div
                  key={letter}
                  className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 ${
                    isCorrect
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-slate-100'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    isCorrect
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {letter}
                  </div>
                  <span className="text-xs sm:text-sm leading-relaxed font-normal flex-1">{text}</span>
                  {isCorrect && (
                    <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Gabarito
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {answer && (answer.comments || answer.commentMediaUrl || answer.correctAlternative) && (
            <div className="mt-4 rounded-xl bg-teal-500/10 border border-teal-500/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setCommentsOpen(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-teal-400"
              >
                <span>COMENTÁRIOS</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${commentsOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {commentsOpen && (
                <div className="px-4 pb-4 text-xs sm:text-sm text-slate-300 space-y-2">
                  {answer.correctAlternative && (
                    <p className="font-bold text-teal-400">GABARITO: {answer.correctAlternative}</p>
                  )}
                  {answer.comments && (
                    <p className="text-slate-300 leading-relaxed mt-4">{answer.comments}</p>
                  )}
                  {answer.commentMediaUrl && <CommentMedia url={answer.commentMediaUrl} />}
                  <ReferenceSource reference={references.find(r => r.id === answer.referenceId)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
