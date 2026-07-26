import React, { useState } from 'react';
import { Award, RotateCcw, ArrowRight, CheckCircle2, XCircle, Clock, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { QuizAttempt } from '../types';

interface QuizResultViewProps {
  attempt: QuizAttempt;
  onRestart: () => void;
  onNavigateToStats: () => void;
}

export const QuizResultView: React.FC<QuizResultViewProps> = ({
  attempt,
  onRestart,
  onNavigateToStats
}) => {
  const [expandedAnswers, setExpandedAnswers] = useState<Record<number, boolean>>({});

  const toggleAnswerExpand = (idx: number) => {
    setExpandedAnswers(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const percentage = Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100);

  let resultColor = 'text-emerald-400';
  let badgeTitle = 'Aprovado TEOT 🏆';
  let badgeSubtitle = 'Excelente desempenho! Seu percentual de acerto está acima do ponto de corte oficial.';

  if (percentage < 50) {
    resultColor = 'text-rose-400';
    badgeTitle = 'Reforço Necessário ⚠️';
    badgeSubtitle = 'Recomendamos revisar a teoria do tema e refazer o caderno de erros.';
  } else if (percentage < 70) {
    resultColor = 'text-amber-400';
    badgeTitle = 'Bom Rendimento 👍';
    badgeSubtitle = 'Você acertou mais da metade das questões. Foco nos pontos fracos para garantir aprovação.';
  }

  const formatMinutes = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const r = secs % 60;
    return `${mins}m ${r}s`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Result Score Card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-teal-400 shadow-xl">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <h1 className={`text-4xl sm:text-5xl font-extrabold font-outfit ${resultColor}`}>
              {percentage}%
            </h1>
            <p className="text-xl font-bold text-white mt-1">{badgeTitle}</p>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mt-2">
              {badgeSubtitle}
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-300">
            <div className="flex items-center space-x-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Acertos: <strong>{attempt.correctAnswers} / {attempt.totalQuestions}</strong></span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Tempo Total: <strong>{formatMinutes(attempt.timeSpentSeconds)}</strong></span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onRestart}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-teal-500/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Novo Simulado</span>
            </button>

            <button
              onClick={onNavigateToStats}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Ver Estatísticas Globais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Questions Breakdown List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white font-outfit border-b border-slate-800 pb-3">
          Revisão Detalhada das Questões ({attempt.answers.length})
        </h3>

        <div className="space-y-3">
          {attempt.answers.map((log, idx) => {
            const isExpanded = expandedAnswers[idx];
            const q = log.question;

            return (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden transition"
              >
                <div
                  onClick={() => toggleAnswerExpand(idx)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 select-none"
                >
                  <div className="flex items-start space-x-3 pr-4">
                    {log.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">
                          Questão {idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {q.area}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2 mt-1">
                        {q.enunciado}
                      </p>
                    </div>
                  </div>

                  <button className="text-slate-400 hover:text-white shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-3 text-xs">
                    <p className="text-slate-200 font-medium">{q.enunciado}</p>

                    <div className="space-y-1.5">
                      {(q.opcoes || []).map((op, oIdx) => {
                        const isChosen = log.selectedOption === oIdx;
                        const isRight = q.respostaCorreta === oIdx;

                        let style = 'bg-slate-900 text-slate-400 border-slate-800';
                        if (isRight) style = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold';
                        else if (isChosen && !isRight) style = 'bg-rose-500/20 text-rose-300 border-rose-500/50';

                        return (
                          <div key={oIdx} className={`p-2.5 rounded-xl border flex items-center justify-between ${style}`}>
                            <span>{String.fromCharCode(65 + oIdx)}. {op}</span>
                            {isRight && <span className="text-[10px] text-emerald-400 uppercase font-bold">Correta</span>}
                            {isChosen && !isRight && <span className="text-[10px] text-rose-400 uppercase font-bold">Sua Escolha</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1 mt-2">
                      <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-[11px]">
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Comentário SBOT:</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{q.explicacao}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
