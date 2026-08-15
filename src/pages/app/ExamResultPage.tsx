import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, ArrowLeft, BookOpen, BarChart3, ChevronDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { getAttemptById, getExamQuestions, getAttemptAnswers, getQuestionAnswer, getExamById, getAreas, getThemes, getQuestionsByIds, getReferences } from '../../services/firebaseService';
import { Attempt, ExamQuestion, AttemptAnswer, QuestionAnswer, Exam, Area, Theme, Reference } from '../../types';
import { getSourceExamChipClass } from '../../constants';
import { CommentMedia } from '../../components/CommentMedia';
import { ReferenceSource } from '../../components/ReferenceSource';
import { scoreColorClass, scoreColorHex } from '../../utils/helpers';

export const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
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
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

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
        
        // Sempre na ordem de elaboração da prova (`orderIndex`), mesmo quando
        // `shuffleQuestions` está ligado: o embaralhamento existe só para o
        // momento de execução. O relatório é material de estudo e segue a
        // ordem canônica da prova, igual à que o admin vê em ExamViewPage.
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
          setReferences(await getReferences());
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
      .map(t => {
        const theme = themes.find(th => th.id === t.themeId);
        return {
          ...t,
          name: theme?.name || t.themeId,
          groupName: theme?.groupName,
          accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [questions, answers, themes]);

  // Desempenho por Grupo TEOT nesta prova — cruza Áreas (ex.: "Trauma
  // Adulto" reúne temas de Mão, Joelho, Ombro e Cotovelo etc.), por isso é
  // um bloco à parte, não um drill-down da barra por Área abaixo.
  const groupBreakdown = useMemo(() => {
    const map: Record<string, { groupName: string; total: number; correct: number }> = {};
    themeBreakdown.forEach(t => {
      if (!t.groupName) return;
      if (!map[t.groupName]) map[t.groupName] = { groupName: t.groupName, total: 0, correct: 0 };
      map[t.groupName].total += t.total;
      map[t.groupName].correct += t.correct;
    });
    return Object.values(map)
      .map(g => ({ ...g, accuracy: g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [themeBreakdown]);

  if (loading || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando relatório do simulado...</p>
      </div>
    );
  }

  const score = attempt.scorePercentage || 0;

  return (
    <div className="space-y-8 pb-12">

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/history')}
          aria-label="Voltar para o Histórico"
          title="Voltar para o Histórico"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {attempt.userName && (
          <span className="text-sm font-bold text-slate-300 truncate">{attempt.userName}</span>
        )}
      </div>

      {/* Main KPI Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
          score >= 60 ? 'bg-[#079551]/10' : score >= 50 ? 'bg-cyan-500/10' : 'bg-red-500/10'
        }`} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="min-w-0 flex-1 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 break-words">
              {attempt.examName || 'Simulado Ortopedia TEOT'}
            </h1>
          </div>
          <div className="text-center md:text-right shrink-0">
            <div className={`text-6xl sm:text-7xl font-black tracking-tight ${scoreColorClass(score)}`}>
              {attempt.scorePercentage}%
            </div>
          </div>
        </div>

        {/* Desempenho por Área e Tema nesta prova — substitui os cards de
            Acertos/Erros/Sem Resposta por análises gráficas mais úteis para
            identificar pontos fracos e alimentar sugestões futuras de estudo. */}
        {areaBreakdown.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                Desempenho por Área nesta Prova
              </h3>
              <div className="h-56 sm:h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaBreakdown} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#F2F2F5" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9AA2A9', fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#6B7680', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#F2F2F5', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value}%`, 'Aproveitamento']}
                    />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                      {areaBreakdown.map(a => (
                        <Cell key={a.areaId} fill={scoreColorHex(a.accuracy)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {groupBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3">Desempenho por Grupo (TEOT) nesta Prova</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {groupBreakdown.map(g => {
                    const tone = scoreColorClass(g.accuracy);
                    return (
                      <div key={g.groupName} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-300 truncate">{g.groupName}</span>
                        <span className={`font-bold shrink-0 ${tone}`}>
                          {g.accuracy}% <span className="text-xs text-slate-500 font-normal">({g.correct}/{g.total})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {themeBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3">Temas desta Prova (do mais fraco ao mais forte)</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {themeBreakdown.map(t => {
                    const tone = scoreColorClass(t.accuracy);
                    return (
                      <div key={t.themeId} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-300 truncate">
                          {t.name}
                          {t.groupName && <span className="text-slate-500 font-normal"> · {t.groupName}</span>}
                        </span>
                        <span className={`font-bold shrink-0 ${tone}`}>
                          {t.accuracy}% <span className="text-xs text-slate-500 font-normal">({t.correct}/{t.total})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
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
            Questões, Gabaritos e Comentários
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
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {sourceExamById[q.originalQuestionId] && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${getSourceExamChipClass(sourceExamById[q.originalQuestionId])}`}>
                          {sourceExamById[q.originalQuestionId]}
                        </span>
                      )}
                      {isCorrect ? (
                        <span
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          role="img"
                          aria-label="Questão correta"
                          title="Correta"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      ) : selected ? (
                        <span
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-300 border border-red-500/30"
                          role="img"
                          aria-label="Questão incorreta"
                          title="Incorreta"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Não Respondida
                        </span>
                      )}
                    </div>
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

                      let style = 'bg-slate-950 border-slate-800/80 text-slate-100';
                      
                      if (isCorrectKey) {
                        style = 'bg-emerald-500/15 border-emerald-500/50 text-slate-100 font-semibold';
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

                  {key && (key.comments || key.commentMediaUrl || key.correctAlternative) && (
                    <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenComments(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-teal-400"
                      >
                        <span>COMENTÁRIOS</span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${openComments[q.id] ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openComments[q.id] && (
                        <div className="px-4 pb-4 text-xs text-slate-100 space-y-2">
                          {key.correctAlternative && (
                            <p className="font-bold text-teal-400">GABARITO: {key.correctAlternative}</p>
                          )}
                          {key.comments && (
                            <p className="text-slate-100 leading-relaxed mt-4">{key.comments}</p>
                          )}
                          {key.commentMediaUrl && <CommentMedia url={key.commentMediaUrl} />}
                          <ReferenceSource reference={references.find(r => r.id === key.referenceId)} />
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
