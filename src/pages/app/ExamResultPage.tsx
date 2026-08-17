import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, ArrowLeft, BookOpen, BarChart3, ChevronDown, X, Download, Loader2, FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts';
import { getAttemptById, getExamQuestions, getAttemptAnswers, getQuestionAnswer, getExamById, getAreas, getThemes, getQuestionsByIds, getReferences } from '../../services/firebaseService';
import { Attempt, ExamQuestion, AttemptAnswer, QuestionAnswer, Exam, Area, Theme, Reference } from '../../types';
import { getSourceExamChipClass } from '../../constants';
import { CommentMedia } from '../../components/CommentMedia';
import { ReferenceSource } from '../../components/ReferenceSource';
import { scoreColorClass, scoreColorHex } from '../../utils/helpers';
import { generateAndDownloadExamReportPdf, viewExamReportPdf } from '../../services/examReportService';

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  // Filtro único (Área, Grupo TEOT ou Tema) aplicado a partir do clique nas
  // barras dos gráficos ou nas linhas da tabela de Temas. Um novo clique
  // sempre substitui o filtro anterior; clique fora de qualquer barra/linha
  // (capturado no document, já que os cliques internos chamam
  // stopPropagation) limpa o filtro.
  const [filter, setFilter] = useState<{ type: 'area' | 'group' | 'theme'; value: string } | null>(null);

  useEffect(() => {
    const clearOnOutsideClick = () => setFilter(null);
    document.addEventListener('click', clearOnOutsideClick);
    return () => document.removeEventListener('click', clearOnOutsideClick);
  }, []);

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
    return Object.values(map)
      .map(a => ({
        ...a,
        name: areas.find(ar => ar.id === a.areaId)?.name || a.areaId,
        accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
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
          areaId: theme?.areaId,
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
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [themeBreakdown]);

  // Aplica o filtro ativo (Área, Grupo TEOT ou Tema) sobre a tabela de Temas
  // e sobre as questões exibidas na seção de revisão abaixo.
  const filteredThemeBreakdown = useMemo(() => {
    if (!filter || filter.type === 'theme') return themeBreakdown;
    if (filter.type === 'area') return themeBreakdown.filter(t => t.areaId === filter.value);
    return themeBreakdown.filter(t => t.groupName === filter.value);
  }, [themeBreakdown, filter]);

  const filteredQuestions = useMemo(() => {
    if (!filter) return questions;
    if (filter.type === 'area') return questions.filter(q => q.areaId === filter.value);
    if (filter.type === 'theme') return questions.filter(q => q.themeId === filter.value);
    const themeIdsInGroup = new Set(themes.filter(t => t.groupName === filter.value).map(t => t.id));
    return questions.filter(q => themeIdsInGroup.has(q.themeId));
  }, [questions, filter, themes]);

  const filterLabel = useMemo(() => {
    if (!filter) return '';
    if (filter.type === 'area') return areas.find(a => a.id === filter.value)?.name || filter.value;
    if (filter.type === 'theme') return themes.find(t => t.id === filter.value)?.name || filter.value;
    return filter.value;
  }, [filter, areas, themes]);

  if (loading || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando relatório do simulado...</p>
      </div>
    );
  }

  const score = attempt.scorePercentage || 0;

  const handleDownloadPdf = async () => {
    if (downloadingPdf || !attemptId) return;

    // Já foi gerado antes (mesma tentativa): só abre pra visualização, sem
    // chamar a Cloud Function de novo.
    if (attempt.reportPdfUrl) {
      viewExamReportPdf(attempt.reportPdfUrl);
      return;
    }

    setDownloadingPdf(true);
    try {
      const { url, fileName } = await generateAndDownloadExamReportPdf(attemptId);
      setAttempt(prev => (prev ? { ...prev, reportPdfUrl: url, reportPdfFileName: fileName } : prev));
    } catch (err) {
      console.error('Erro ao gerar o PDF do relatório:', err);
      alert('Não foi possível gerar o PDF do relatório agora. Tente novamente em instantes.');
    } finally {
      setDownloadingPdf(false);
    }
  };

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
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="flex items-center gap-2 px-4 h-10 rounded-full bg-teal-600 text-white text-xs font-bold hover:bg-teal-500 disabled:opacity-60 disabled:cursor-progress transition-colors shrink-0"
        >
          {downloadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Gerando PDF…</span>
            </>
          ) : attempt.reportPdfUrl ? (
            <>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Ver PDF</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar PDF</span>
            </>
          )}
        </button>
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
            identificar pontos fracos e alimentar sugestões futuras de estudo.
            Clicar numa barra ou numa linha de tema filtra a tabela de Temas
            e as questões da seção abaixo; um novo clique sempre substitui o
            filtro anterior (ver estado `filter`), e cliques fora de
            qualquer barra/linha (capturados no document) limpam o filtro. */}
        {areaBreakdown.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-6">
            {filter && (
              <div className="flex items-center justify-between gap-3 bg-teal-500/10 border border-teal-500/30 rounded-xl px-4 py-2">
                <span className="text-xs text-teal-300">
                  Filtrando por: <span className="font-bold">{filterLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFilter(null); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase text-teal-300 hover:text-teal-100"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar
                </button>
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                Desempenho por Área nesta Prova
              </h3>
              <div className="h-56 sm:h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaBreakdown} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#F2F2F5" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9AA2A9', fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#6B7680', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#F2F2F5', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value}%`, 'Aproveitamento']}
                    />
                    <Bar
                      dataKey="accuracy"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(data: any, _index: number, event: any) => {
                        event?.stopPropagation?.();
                        setFilter({ type: 'area', value: data.areaId });
                      }}
                    >
                      {areaBreakdown.map(a => (
                        <Cell
                          key={a.areaId}
                          fill={scoreColorHex(a.accuracy)}
                          opacity={filter && filter.type === 'area' && filter.value !== a.areaId ? 0.35 : 1}
                        />
                      ))}
                      <LabelList
                        dataKey="accuracy"
                        position="right"
                        formatter={(value: number) => `${value}%`}
                        style={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {groupBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1">Desempenho por Grupo (TEOT) nesta Prova</h3>
                <div className="h-56 sm:h-72 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupBreakdown} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke="#F2F2F5" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9AA2A9', fontSize: 10 }} unit="%" />
                      <YAxis type="category" dataKey="groupName" width={110} tick={{ fill: '#6B7680', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#F2F2F5', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(value: number) => [`${value}%`, 'Aproveitamento']}
                      />
                      <Bar
                        dataKey="accuracy"
                        radius={[0, 6, 6, 0]}
                        cursor="pointer"
                        onClick={(data: any, _index: number, event: any) => {
                          event?.stopPropagation?.();
                          setFilter({ type: 'group', value: data.groupName });
                        }}
                      >
                        {groupBreakdown.map(g => (
                          <Cell
                            key={g.groupName}
                            fill={scoreColorHex(g.accuracy)}
                            opacity={filter && filter.type === 'group' && filter.value !== g.groupName ? 0.35 : 1}
                          />
                        ))}
                        <LabelList
                          dataKey="accuracy"
                          position="right"
                          formatter={(value: number) => `${value}%`}
                          style={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {themeBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3">Temas desta Prova (do mais fraco ao mais forte)</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredThemeBreakdown.map(t => {
                    const tone = scoreColorClass(t.accuracy);
                    const isSelected = filter?.type === 'theme' && filter.value === t.themeId;
                    return (
                      <button
                        type="button"
                        key={t.themeId}
                        onClick={(e) => { e.stopPropagation(); setFilter({ type: 'theme', value: t.themeId }); }}
                        className={`w-full flex items-center justify-between gap-3 text-sm py-1.5 px-2 -mx-2 rounded-lg border-b border-slate-800/60 last:border-0 text-left transition-colors ${
                          isSelected ? 'bg-teal-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-slate-300 truncate">
                          {t.name}
                          {t.groupName && <span className="text-slate-500 font-normal"> · {t.groupName}</span>}
                        </span>
                        <span className={`font-bold shrink-0 ${tone}`}>
                          {t.accuracy}% <span className="text-xs text-slate-500 font-normal">({t.correct}/{t.total})</span>
                        </span>
                      </button>
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
            {filteredQuestions.map((q) => {
              const idx = questions.indexOf(q);
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
