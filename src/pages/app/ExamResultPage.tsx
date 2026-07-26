import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, XCircle, Clock, Award, ArrowLeft, BookOpen, AlertCircle, Sparkles, Check, HelpCircle 
} from 'lucide-react';
import { getAttemptById, getExamQuestions, getAttemptAnswers, getQuestionAnswer, getExamById } from '../../services/firebaseService';
import { Attempt, ExamQuestion, AttemptAnswer, QuestionAnswer, Exam } from '../../types';
import { formatTimeSeconds } from '../../utils/helpers';

export const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [answerKeys, setAnswerKeys] = useState<Record<string, QuestionAnswer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResult() {
      if (!attemptId) return;
      try {
        setLoading(true);
        const att = await getAttemptById(attemptId);
        if (!att) throw new Error("Tentativa não encontrada");
        setAttempt(att);

        const examData = await getExamById(att.examId);
        setExam(examData);

        const examQs = await getExamQuestions(att.examId);
        setQuestions(examQs);

        const userAns = await getAttemptAnswers(attemptId);
        const ansMap: Record<string, AttemptAnswer> = {};
        userAns.forEach(a => { ansMap[a.examQuestionId] = a; });
        setAnswers(ansMap);

        // Fetch answer keys for review if enabled
        if (!examData || examData.showCommentsAfterFinish !== false) {
          const keysMap: Record<string, QuestionAnswer> = {};
          for (const q of examQs) {
            const key = await getQuestionAnswer(q.originalQuestionId);
            if (key) keysMap[q.originalQuestionId] = key;
          }
          setAnswerKeys(keysMap);
        }

      } catch (err) {
        console.error("Erro ao carregar resultados:", err);
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [attemptId]);

  if (loading || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando relatório do simulado...</p>
      </div>
    );
  }

  const isPassed = (attempt.scorePercentage || 0) >= 60;

  return (
    <div className="space-y-8 pb-12">
      
      <Link to="/app/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Minhas Provas</span>
      </Link>

      {/* Main KPI Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
          isPassed ? 'bg-teal-500/10' : 'bg-amber-500/10'
        }`} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Resultado Oficial
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {attempt.examName || 'Simulado Ortopedia TEOT'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Desempenho avaliado pela Sociedade Brasileira de Ortopedia e Traumatologia.
            </p>
          </div>

          <div className="text-center md:text-right shrink-0">
            <div className={`text-4xl sm:text-5xl font-black tracking-tight ${
              isPassed ? 'text-teal-400' : 'text-amber-400'
            }`}>
              {attempt.scorePercentage}%
            </div>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              {attempt.correctAnswers} acertos de {attempt.totalQuestions} questões
            </p>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Acertos</p>
            <p className="text-base font-bold text-white mt-0.5">{attempt.correctAnswers}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
            <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Erros</p>
            <p className="text-base font-bold text-white mt-0.5">{attempt.wrongAnswers}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
            <HelpCircle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Sem Resposta</p>
            <p className="text-base font-bold text-white mt-0.5">{attempt.unansweredQuestions}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
            <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Tempo Total</p>
            <p className="text-base font-bold text-white mt-0.5">
              {formatTimeSeconds(attempt.elapsedSeconds || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Question Review List */}
      {exam?.allowReviewAfterFinish !== false && (
        <section className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Revisão Detalhada das Questões ({questions.length})
          </h2>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAns = answers[q.id];
              const key = answerKeys[q.originalQuestionId];

              const selected = userAns?.selectedAlternative;
              const correct = key?.correctAlternative;
              const isCorrect = userAns?.isCorrect;

              return (
                <div
                  key={q.id}
                  className={`bg-slate-900 border rounded-2xl p-6 shadow-xl transition-all ${
                    isCorrect
                      ? 'border-emerald-500/30'
                      : selected
                      ? 'border-red-500/30'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Question Banner Header */}
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300">
                      Questão {idx + 1}
                    </span>

                    {isCorrect ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Correta
                      </span>
                    ) : selected ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Incorreta
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Não Respondida
                      </span>
                    )}
                  </div>

                  {/* Enunciado */}
                  <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-line mb-4">
                    {q.statement}
                  </p>

                  {/* Image */}
                  {q.imageUrl && (
                    <div className="mb-4">
                      <img src={q.imageUrl} alt="Imagem da questão" className="max-h-60 rounded-xl object-contain bg-slate-950 p-2 border border-slate-800" />
                    </div>
                  )}

                  {/* Alternatives */}
                  <div className="space-y-2 mb-6">
                    {(['A', 'B', 'C', 'D'] as const).map((altKey) => {
                      const text = q.alternatives[altKey];
                      if (!text) return null;

                      const isSelectedByUser = selected === altKey;
                      const isCorrectKey = correct === altKey;

                      let style = 'bg-slate-950 border-slate-800/80 text-slate-300';
                      if (isCorrectKey) {
                        style = 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold';
                      } else if (isSelectedByUser && !isCorrectKey) {
                        style = 'bg-red-500/15 border-red-500/50 text-red-200';
                      }

                      return (
                        <div
                          key={altKey}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all ${style}`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                            isCorrectKey
                              ? 'bg-emerald-500 text-slate-950'
                              : isSelectedByUser
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {altKey}
                          </div>
                          <span className="leading-relaxed flex-1">{text}</span>
                          {isCorrectKey && <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0">Gabarito</span>}
                          {isSelectedByUser && !isCorrectKey && <span className="text-[10px] uppercase font-bold text-red-400 shrink-0">Sua Escolha</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Comment & Solution Explanation */}
                  {key && (key.comments || key.solutionText) && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 space-y-2">
                      {key.solutionText && (
                        <div>
                          <strong className="text-teal-400 block mb-0.5 font-semibold">Resolução:</strong>
                          <p className="text-slate-300 leading-relaxed">{key.solutionText}</p>
                        </div>
                      )}
                      {key.comments && (
                        <div>
                          <strong className="text-cyan-400 block mb-0.5 font-semibold">Comentários do Gabarito:</strong>
                          <p className="text-slate-300 leading-relaxed">{key.comments}</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
};
