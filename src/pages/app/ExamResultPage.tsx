import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Award, ArrowLeft, BookOpen, AlertCircle, Sparkles, Check, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { getAttemptById, getExamQuestions, getAttemptAnswers, getQuestionAnswer, getExamById, getAreas, getThemes, getQuestionsByIds } from '../../services/firebaseService';
import { Attempt, ExamQuestion, AttemptAnswer, QuestionAnswer, Exam, Area, Theme } from '../../types';
import { getSourceExamChipClass } from '../../constants';

export const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [answerKeys, setAnswerKeys] = useState<Record<string, QuestionAnswer>>({});
  // `sourceExam` não faz parte da cópia congelada em exams/{id}/questions —
  // buscado à parte só para colorir o chip de origem ao lado de "Questão X".
  const [sourceExamById, setSourceExamById] = useState<Record<string, string>>({});
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
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

        const [areaList, themeList, originalQuestions] = await Promise.all([
          getAreas(),
          getThemes(),
          getQuestionsByIds(examQs.map(q => q.originalQuestionId))
        ]);
        setAreas(areaList);
        setThemes(themeList);
        const sourceMap: Record<string, string> = {};
        Object.values(originalQuestions).forEach(oq => { sourceMap[oq.id] = oq.sourceExam; });
        setSourceExamById(sourceMap);

        if (!examData || examData.showCommentsAfterFinish !== false) {
          const keysMap: Record<string, QuestionAnswer> = {};
          
          const keysPromises = examQs.map(async (q) => {
            const key = await getQuestionAnswer(q.originalQuestionId);
            if (key) {
              keysMap[q.originalQuestionId] = key;
            }
          });

          await Promise.all(keysPromises);
          
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

  // Desempenho desta prova especificamente, por Área e Tema — só entram
  // questões efetivamente respondidas. Serve tanto para os gráficos abaixo
  // quanto de insumo futuro para sugestões de estudo no dashboard do usuário.
  const areaBreakdown = useMemo(() => {
    const map: Record<string, { areaId: string; total: number; correct: number }> = {};
    questions.forEach(q => {
      const ans = answers[q.id];
      if (!ans || !ans.selectedAlternative) return;
      if (!map[q.areaId]) map[q.areaId] = { areaId: q.areaId, total: 0, correct: 0 };
      map[q.areaId].total += 1;
      if (ans.isCorrect) map[q.areaId].correct += 1;
    });
    return Object.values(map).map(a => ({
      ...a,
      name: areas.find(ar => ar.id === a.areaId)?.name || a.areaId,
      accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0
    }));
  }, [questions, answers, areas]);

  const themeBreakdown = useMemo(() => {
    const map: Record<string, { themeId: string; total: number; correct: number }> = {};
    questions.forEach(q => {
      const ans = answers[q.id];
      if (!ans || !ans.selectedAlternative) return;
      if (!map[q.themeId]) map[q.themeId] = { themeId: q.themeId, total: 0, correct: 0 };
      map[q.themeId].total += 1;
      if (ans.isCorrect) map[q.themeId].correct += 1;
    });
    return Object.values(map)
      .map(t => ({
        ...t,
        name: themes.find(th => th.id === t.themeId)?.name || t.themeId,
        accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [questions, answers, themes]);

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
      
      <Link to="/app/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41] transition-colors">
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#050f41] mt-2">
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

        {/* Desempenho por Área e Tema nesta prova — substitui os cards de
            Acertos/Erros/Sem Resposta por análises gráficas mais úteis para
            identificar pontos fracos e alimentar sugestões futuras de estudo. */}
        {areaBreakdown.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                Desempenho por Área nesta Prova
              </h3>
              <p className="text-xs text-slate-400 mb-2">Percentual de acerto entre as questões respondidas, por área.</p>
              <div className="h-56 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaBreakdown} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#dbe0f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#7680ac', fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#4b567f', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value}%`, 'Aproveitamento']}
                    />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                      {areaBreakdown.map(a => (
                        <Cell key={a.areaId} fill={a.accuracy >= 60 ? '#079551' : a.accuracy >= 40 ? '#fab932' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {themeBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-[#050f41] mb-3">Temas desta Prova (do mais fraco ao mais forte)</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {themeBreakdown.map(t => {
                    const tone = t.accuracy >= 60 ? 'text-emerald-400' : t.accuracy >= 40 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div key={t.themeId} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-300 truncate">{t.name}</span>
                        <span className={`font-bold shrink-0 ${tone}`}>
                          {t.accuracy}% <span className="text-xs text-slate-500 font-normal">({t.correct}/{t.total})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-3 italic">
                  Esses dados também alimentam as sugestões de revisão em "Meu Desempenho".
                </p>
              </div>
            )}
          </div>
        )}
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
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        Questão {idx + 1}
                      </span>
                      {sourceExamById[q.originalQuestionId] && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceExamChipClass(sourceExamById[q.originalQuestionId])}`}>
                          {sourceExamById[q.originalQuestionId]}
                        </span>
                      )}
                    </div>
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

                  <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-line mb-4">
                    {q.statement}
                  </p>

                  {q.imageUrl && (
                    <div className="mb-4">
                      <img src={q.imageUrl} alt="Imagem da questão" className="max-h-60 rounded-xl object-contain bg-slate-950 p-2 border border-slate-800" />
                    </div>
                  )}

                  <div className="space-y-2 mb-6">
                    {(['A', 'B', 'C', 'D'] as const).map((altKey) => {
                      const text = q.alternatives[altKey];
                      if (!text) return null;

                      const isSelectedByUser = selected === altKey;
                      const isCorrectKey = correct === altKey;

                      let style = 'bg-slate-950 border-slate-800/80 text-slate-300';
                      
                      if (isCorrectKey) {
                        style = 'bg-emerald-500/15 border-emerald-500/50 text-[#050f41] font-semibold';
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
