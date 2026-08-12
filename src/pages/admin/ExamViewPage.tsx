import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, BarChart3, Users, Power, PowerOff, Trash2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Layers, MapPin, X, Send, PhoneOff } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getExamById, getExamQuestions, getQuestionAnswer, getExamQuestionStats, updateExamActiveStatus, isExamActive, getQuestionsByIds, getAttemptsForExam, subscribeAttemptsForExam, updateExamContent, getAttemptAnswers, getAreas, getThemes, getReferences, createNotification, getExamAssignmentsWithUsers } from '../../services/firebaseService';
import { Exam, ExamQuestion, QuestionAnswer, Question, Attempt, Area, Reference, ExamAssignment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { QuestionImage } from '../../components/QuestionImage';
import { CommentMedia } from '../../components/CommentMedia';
import { ReferenceSource } from '../../components/ReferenceSource';
import { getSourceExamChipClass } from '../../constants';
import { scoreColorClass, buildWhatsAppLink } from '../../utils/helpers';

interface SubmittedRow {
  attempt: Attempt;
  areaScores: Record<string, number | null>; // areaId -> percentage (null = sem questões dessa área nessa tentativa)
}

const PIE_COLORS = ['#050f41', '#06b6d4', '#FAB932', '#079551', '#a855f7', '#f472b6', '#f97316', '#10b981', '#6366f1', '#E20018'];

// Tabelas "Áreas da Prova" e "Temas da Prova" paginadas, 5 linhas por página.
const ROWS_PER_PAGE = 5;

// Marcador (nome + quantidade + %) fora de cada fatia do gráfico de
// distribuição, ligado por uma linha — mesmo estilo dos rótulos usados em
// gráficos de pizza de referência do produto.
const RADIAN = Math.PI / 180;
const renderPieSliceLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, percent, name, value } = props;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fill="#050f41" fontSize={11}>
      <tspan x={x} dy="-0.35em" fontWeight={700}>{name}: {value}</tspan>
      <tspan x={x} dy="1.3em" fontWeight={600} fillOpacity={0.75}>{(percent * 100).toFixed(1)}%</tspan>
    </text>
  );
};

export const ExamViewPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { currentUser } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, QuestionAnswer>>({});
  // `sourceExam` não faz parte da cópia congelada em exams/{id}/questions —
  // buscado à parte só para colorir o chip de origem ao lado de "Questão X".
  const [sourceExamById, setSourceExamById] = useState<Record<string, string>>({});
  // Mapa id-da-questão-original → Question completa, usado só para poder
  // reconstruir `questions: Question[]` ao chamar updateExamContent() na
  // remoção de uma questão (ver handleDeleteQuestion).
  const [originalQuestionsById, setOriginalQuestionsById] = useState<Record<string, Question>>({});
  const [stats, setStats] = useState<Record<string, { totalAnswered: number; totalCorrect: number }>>({});
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  // Se a prova tem alguma tentativa registrada — não muda depois do
  // carregamento inicial (uma vez que existe uma tentativa, ela nunca some).
  const [hasAttempts, setHasAttempts] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  // Tabela "Respostas Enviadas" — uma linha completada por tentativa
  // concluída, com o desempenho por área derivado das respostas individuais.
  const [submittedRows, setSubmittedRows] = useState<SubmittedRow[]>([]);
  // Candidatos atribuídos a esta prova, para a seção "Convidar Candidatos"
  // (botão de envio de convite por WhatsApp com o link direto do assignment).
  const [assignments, setAssignments] = useState<(ExamAssignment & { userName: string; userPhone?: string })[]>([]);
  const [examAreas, setExamAreas] = useState<Area[]>([]);
  // Nome de cada tema/área, usado só para rotular as tabelas e o gráfico de
  // distribuição da prova (ver areaDistribution/themeDistribution abaixo).
  const [themeNameById, setThemeNameById] = useState<Record<string, string>>({});
  const [areaNameById, setAreaNameById] = useState<Record<string, string>>({});
  // Filtros cruzados: clicar numa área na 1ª tabela filtra a 2ª tabela de
  // temas, o gráfico e as questões abaixo; clicar num tema na 2ª tabela
  // filtra o gráfico e as questões (sem afetar a 1ª tabela, que continua no
  // topo da hierarquia Área → Tema).
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  // Mesmo gate usado em CreateExamPage/updateExamContent: só é possível
  // mexer nas questões de uma prova inativa e sem tentativas registradas.
  // Derivado a cada render (em vez de um estado próprio) para não ficar
  // desatualizado quando o admin ativa/desativa a prova nesta mesma tela
  // (handleToggleActive) — antes disso, o botão de excluir podia continuar
  // visível mesmo depois de a prova ser ativada, causando o erro "Só é
  // possível editar provas inativas." ao clicar.
  const canEdit = !!exam && !isExamActive(exam) && !hasAttempts;

  // Quantidade de questões por área nesta prova — 1ª tabela (raiz do filtro
  // cruzado, não é afetada pela seleção de área/tema).
  const areaDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      counts[q.areaId] = (counts[q.areaId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([areaId, count]) => ({ areaId, name: areaNameById[areaId] || 'Área desconhecida', count }))
      .sort((a, b) => b.count - a.count);
  }, [questions, areaNameById]);

  // Quantidade de questões por tema nesta prova (guardando a área de cada
  // tema, para poder filtrar pela área selecionada na 1ª tabela).
  const themeDistributionAll = useMemo(() => {
    const counts: Record<string, { areaId: string; count: number }> = {};
    questions.forEach(q => {
      if (!counts[q.themeId]) counts[q.themeId] = { areaId: q.areaId, count: 0 };
      counts[q.themeId].count += 1;
    });
    return Object.entries(counts)
      .map(([themeId, v]) => ({ themeId, areaId: v.areaId, name: themeNameById[themeId] || 'Tema desconhecido', count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [questions, themeNameById]);

  // 2ª tabela e gráfico: temas restritos à área selecionada (se houver).
  const themeDistribution = useMemo(() => (
    selectedAreaId ? themeDistributionAll.filter(t => t.areaId === selectedAreaId) : themeDistributionAll
  ), [themeDistributionAll, selectedAreaId]);

  // Gráfico: além do filtro de área acima, restrito ao tema selecionado (se
  // houver) — clicar num tema na 2ª tabela "zooma" o gráfico nele.
  const pieData = useMemo(() => (
    selectedThemeId ? themeDistribution.filter(t => t.themeId === selectedThemeId) : themeDistribution
  ), [themeDistribution, selectedThemeId]);

  // Gráfico: só os 5 maiores temas viram fatia própria — o resto é somado
  // numa fatia "Outros" para o gráfico não ficar poluído com muitas fatias
  // finas (pieData já vem ordenado do maior para o menor).
  const chartData = useMemo(() => {
    const top = pieData.slice(0, 5);
    const rest = pieData.slice(5);
    if (rest.length === 0) return top;
    const othersCount = rest.reduce((sum, t) => sum + t.count, 0);
    return [...top, { themeId: '__others__', areaId: '', name: 'Outros', count: othersCount }];
  }, [pieData]);
  const chartTotal = useMemo(() => chartData.reduce((sum, t) => sum + t.count, 0), [chartData]);

  // Questões exibidas abaixo, restritas pelos mesmos filtros cruzados.
  const filteredQuestions = useMemo(() => questions.filter(q => (
    (!selectedAreaId || q.areaId === selectedAreaId) &&
    (!selectedThemeId || q.themeId === selectedThemeId)
  )), [questions, selectedAreaId, selectedThemeId]);

  const handleAreaClick = (areaId: string) => {
    setSelectedAreaId(prev => (prev === areaId ? null : areaId));
    setSelectedThemeId(null);
  };

  const handleThemeClick = (themeId: string) => {
    setSelectedThemeId(prev => (prev === themeId ? null : themeId));
  };

  const clearFilters = () => {
    setSelectedAreaId(null);
    setSelectedThemeId(null);
  };

  const [areaTablePage, setAreaTablePage] = useState(1);
  const areaTableTotalPages = Math.max(1, Math.ceil(areaDistribution.length / ROWS_PER_PAGE));
  const paginatedAreas = useMemo(() => {
    const start = (areaTablePage - 1) * ROWS_PER_PAGE;
    return areaDistribution.slice(start, start + ROWS_PER_PAGE);
  }, [areaDistribution, areaTablePage]);

  const [themeTablePage, setThemeTablePage] = useState(1);
  const themeTableTotalPages = Math.max(1, Math.ceil(themeDistribution.length / ROWS_PER_PAGE));
  const paginatedThemes = useMemo(() => {
    const start = (themeTablePage - 1) * ROWS_PER_PAGE;
    return themeDistribution.slice(start, start + ROWS_PER_PAGE);
  }, [themeDistribution, themeTablePage]);

  // Volta para a primeira página sempre que a prova carregada mudar (troca
  // de examId) ou a distribuição encolher a ponto da página atual não
  // existir mais; a tabela de temas também volta ao trocar o filtro de área.
  useEffect(() => {
    setAreaTablePage(1);
    setThemeTablePage(1);
  }, [examId]);
  useEffect(() => {
    setThemeTablePage(1);
  }, [selectedAreaId]);
  useEffect(() => {
    if (areaTablePage > areaTableTotalPages) setAreaTablePage(areaTableTotalPages);
  }, [areaTablePage, areaTableTotalPages]);
  useEffect(() => {
    if (themeTablePage > themeTableTotalPages) setThemeTablePage(themeTableTotalPages);
  }, [themeTablePage, themeTableTotalPages]);

  useEffect(() => {
    async function loadExam() {
      if (!examId) return;
      try {
        setLoading(true);
        const [examData, examQs, questionStats, attempts, allAreas, allThemes, refList, assignmentList] = await Promise.all([
          getExamById(examId),
          getExamQuestions(examId),
          getExamQuestionStats(examId),
          getAttemptsForExam(examId),
          getAreas(),
          getThemes(),
          getReferences(),
          getExamAssignmentsWithUsers(examId)
        ]);
        setExam(examData);
        setQuestions(examQs);
        setStats(questionStats);
        setHasAttempts(attempts.length > 0);
        setReferences(refList);
        setAssignments(assignmentList);

        // Áreas presentes nesta prova (colunas da tabela de respostas
        // enviadas), na mesma ordem de getAreas() (alfabética).
        const areaIdsInExam = new Set(examQs.map(q => q.areaId));
        setExamAreas(allAreas.filter(a => areaIdsInExam.has(a.id)));

        const themeNames: Record<string, string> = {};
        allThemes.forEach(t => { themeNames[t.id] = t.name; });
        setThemeNameById(themeNames);

        const areaNames: Record<string, string> = {};
        allAreas.forEach(a => { areaNames[a.id] = a.name; });
        setAreaNameById(areaNames);

        const keysMap: Record<string, QuestionAnswer> = {};
        await Promise.all(examQs.map(async (q) => {
          const key = await getQuestionAnswer(q.originalQuestionId);
          if (key) keysMap[q.originalQuestionId] = key;
        }));
        setAnswerKeys(keysMap);

        const originalQuestions = await getQuestionsByIds(examQs.map(q => q.originalQuestionId));
        const sourceMap: Record<string, string> = {};
        Object.values(originalQuestions).forEach(oq => { sourceMap[oq.id] = oq.sourceExam; });
        setSourceExamById(sourceMap);
        setOriginalQuestionsById(originalQuestions);
      } catch (err) {
        console.error("Erro ao carregar prova:", err);
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [examId]);

  // Tabela "Respostas Enviadas" ao vivo — uma nova tentativa concluída
  // aparece nela sozinha, sem precisar recarregar a página.
  useEffect(() => {
    if (!examId || questions.length === 0) return;
    const areaIdsInExam = new Set(questions.map(q => q.areaId));

    const unsubscribe = subscribeAttemptsForExam(examId, async (attempts) => {
      const completedAttempts = attempts.filter(a => a.status === 'completed');
      const rows = await Promise.all(completedAttempts.map(async (attempt) => {
        const answers = await getAttemptAnswers(attempt.id);
        const byArea: Record<string, { correct: number; total: number }> = {};
        answers.forEach(ans => {
          if (!byArea[ans.areaId]) byArea[ans.areaId] = { correct: 0, total: 0 };
          byArea[ans.areaId].total += 1;
          if (ans.isCorrect) byArea[ans.areaId].correct += 1;
        });
        const areaScores: Record<string, number | null> = {};
        Array.from(areaIdsInExam).forEach(areaId => {
          const data = byArea[areaId];
          areaScores[areaId] = data && data.total > 0 ? Math.round((data.correct / data.total) * 100) : null;
        });
        return { attempt, areaScores };
      }));
      rows.sort((a, b) => (b.attempt.scorePercentage || 0) - (a.attempt.scorePercentage || 0));
      setSubmittedRows(rows);
    });

    return unsubscribe;
  }, [examId, questions]);

  // Abre o WhatsApp Web/app com uma mensagem pré-preenchida (nome do
  // candidato + nome da prova) e o link direto para o assignment dele
  // realizar esta prova (/app/exams/:assignmentId) — o admin ainda revisa e
  // confirma o envio dentro do próprio WhatsApp antes de disparar.
  const handleSendInvite = (assignment: ExamAssignment & { userName: string; userPhone?: string }) => {
    if (!exam || !assignment.userPhone || assignment.status !== 'available') return;
    const link = `${window.location.origin}/app/exams/${assignment.id}`;
    const message = `*TEOT HMA 2027:*\n\n${assignment.userName}, a prova ${exam.name} está disponível para você.\n\nAcesse : ${link}`;
    window.open(buildWhatsAppLink(assignment.userPhone, message), '_blank', 'noopener,noreferrer');
  };

  const handleToggleActive = async () => {
    if (!exam) return;
    setToggling(true);
    try {
      const nextActive = !isExamActive(exam);
      await updateExamActiveStatus(exam.id, nextActive);
      setExam({ ...exam, active: nextActive });
      if (nextActive && currentUser) {
        createNotification({
          type: 'exam_activated',
          message: `${currentUser.name} ativou a prova ${exam.name} para realização`,
          audience: 'users_only',
          actorId: currentUser.id,
          actorName: currentUser.name
        }).catch(err => console.error('Erro ao criar notificação de ativação de prova:', err));
      }
    } catch (err: any) {
      alert("Erro ao alterar status da prova: " + (err?.message || "erro desconhecido."));
    } finally {
      setToggling(false);
    }
  };

  // Remove uma questão desta prova (não do banco global — apenas desanexa da
  // cópia congelada em exams/{id}/questions), reconstruindo a lista restante
  // e salvando pelo mesmo caminho de escrita usado pelo assistente de edição
  // (updateExamContent), que já reconstrói a subcoleção do zero.
  const handleDeleteQuestion = async (examQuestion: ExamQuestion) => {
    if (!exam || !canEdit) return;
    if (!window.confirm('Remover esta questão da prova? Essa ação não pode ser desfeita.')) return;

    setRemovingQuestionId(examQuestion.id);
    try {
      const remaining = questions.filter(q => q.id !== examQuestion.id);
      const remainingFullQuestions = remaining
        .map(q => originalQuestionsById[q.originalQuestionId])
        .filter((q): q is Question => !!q);

      if (remainingFullQuestions.length !== remaining.length) {
        throw new Error("Uma ou mais questões restantes não foram encontradas no banco de questões.");
      }

      await updateExamContent({
        examId: exam.id,
        examData: {
          name: exam.name,
          shuffleQuestions: exam.shuffleQuestions,
          shuffleAlternatives: exam.shuffleAlternatives,
          showResultAfterFinish: exam.showResultAfterFinish,
          showCommentsAfterFinish: exam.showCommentsAfterFinish,
          allowReviewAfterFinish: exam.allowReviewAfterFinish
        },
        questions: remainingFullQuestions
      });

      setQuestions(remaining);
    } catch (err: any) {
      alert("Erro ao remover questão da prova: " + (err?.message || "erro desconhecido."));
    } finally {
      setRemovingQuestionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando prova...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-4">
        <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41]">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Provas</span>
        </Link>
        <p className="text-sm text-slate-400">Prova não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Lista de Provas</span>
      </Link>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#050f41] tracking-tight">{exam.name}</h1>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            isExamActive(exam)
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isExamActive(exam) ? 'Ativa' : 'Inativa'}
          </span>
        </div>

        <button
          onClick={handleToggleActive}
          disabled={toggling}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-40 ${
            isExamActive(exam)
              ? 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
              : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
          }`}
        >
          {isExamActive(exam) ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          <span>{isExamActive(exam) ? 'Desativar Prova' : 'Ativar Prova'}</span>
        </button>
      </div>

      {assignments.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            Convidar Candidatos ({assignments.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Candidato</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Convite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {assignments.map((a) => {
                  const statusMeta = {
                    available: { label: 'Disponível', className: 'bg-slate-800 text-slate-300 border-slate-700' },
                    started: { label: 'Em andamento', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                    completed: { label: 'Concluída', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                  }[a.status];
                  return (
                    <tr key={a.id}>
                      <td className="p-3 font-semibold text-[#050f41]">{a.userName}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {a.status !== 'available' ? (
                          <button
                            type="button"
                            disabled
                            title={a.status === 'completed' ? 'Esta prova já foi concluída pelo candidato.' : 'Esta prova já está em andamento para o candidato.'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-500 border border-slate-700 opacity-60 cursor-not-allowed"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Enviar Convite
                          </button>
                        ) : a.userPhone ? (
                          <button
                            type="button"
                            onClick={() => handleSendInvite(a)}
                            title={`Enviar convite via WhatsApp para ${a.userName}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Enviar Convite
                          </button>
                        ) : (
                          <Link
                            to={`/admin/users/${a.userId}`}
                            title="Cadastre o telefone do usuário para enviar convite por WhatsApp"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300 transition-colors"
                          >
                            <PhoneOff className="w-3.5 h-3.5" />
                            Sem telefone
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {areaDistribution.length > 0 && (
        <div className="space-y-3">
          {(selectedAreaId || selectedThemeId) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Filtrando por:</span>
              {selectedAreaId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold">
                  {areaNameById[selectedAreaId] || 'Área'}
                </span>
              )}
              {selectedThemeId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold">
                  {themeNameById[selectedThemeId] || 'Tema'}
                </span>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-[#050f41] font-semibold"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            {/* Áreas da Prova — raiz do filtro cruzado. 2/7 da largura no
                desktop (mesmo tanto que a tabela de Temas; o gráfico fica
                com 3/7). */}
            <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Áreas da Prova
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Área</th>
                      <th className="p-3">Questões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paginatedAreas.map((a) => {
                      const idx = areaDistribution.indexOf(a);
                      const isSelected = selectedAreaId === a.areaId;
                      return (
                        <tr
                          key={a.areaId}
                          onClick={() => handleAreaClick(a.areaId)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className="p-3 font-semibold text-[#050f41] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="truncate">{a.name}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-300">{a.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {areaTableTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAreaTablePage(p => Math.max(1, p - 1))}
                    disabled={areaTablePage === 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Anterior
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Página <strong className="text-slate-200">{areaTablePage}</strong> de {areaTableTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAreaTablePage(p => Math.min(areaTableTotalPages, p + 1))}
                    disabled={areaTablePage === areaTableTotalPages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* Temas da Prova — filtrado pela área selecionada, se houver. 2/7 da largura no desktop. */}
            <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Temas da Prova
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Tema</th>
                      <th className="p-3">Questões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paginatedThemes.map((t) => {
                      const idx = themeDistribution.indexOf(t);
                      const isSelected = selectedThemeId === t.themeId;
                      return (
                        <tr
                          key={t.themeId}
                          onClick={() => handleThemeClick(t.themeId)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className="p-3 font-semibold text-[#050f41] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="truncate">{t.name}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-300">{t.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {themeTableTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setThemeTablePage(p => Math.max(1, p - 1))}
                    disabled={themeTablePage === 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Anterior
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Página <strong className="text-slate-200">{themeTablePage}</strong> de {themeTableTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setThemeTablePage(p => Math.min(themeTableTotalPages, p + 1))}
                    disabled={themeTablePage === themeTableTotalPages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* Gráfico — reflete os filtros de área e tema selecionados. 3/7 da largura no desktop. */}
            <section className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Distribuição por Tema
              </h2>
              <div className="relative h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 24, right: 64, bottom: 24, left: 64 }}>
                    <Pie
                      data={chartData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius="45%"
                      outerRadius="72%"
                      paddingAngle={2}
                      label={renderPieSliceLabel}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      isAnimationActive
                    >
                      {chartData.map((t, i) => (
                        <Cell key={t.themeId} fill={t.themeId === '__others__' ? '#64748b' : PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [`${value} questões`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-2xl sm:text-3xl font-black text-[#050f41]">{chartTotal}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {submittedRows.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-cyan-400" />
            Respostas Enviadas ({submittedRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Desempenho na Prova</th>
                  {examAreas.map(area => (
                    <th key={area.id} className="p-3">{area.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {submittedRows.map(({ attempt, areaScores }) => (
                  <tr key={attempt.id}>
                    <td className="p-3 font-semibold text-[#050f41]">{attempt.userName || '—'}</td>
                    <td className={`p-3 font-black ${scoreColorClass(attempt.scorePercentage || 0)}`}>
                      {attempt.scorePercentage ?? 0}%
                    </td>
                    {examAreas.map(area => {
                      const score = areaScores[area.id];
                      return (
                        <td key={area.id} className={score === null ? 'p-3 text-slate-600' : `p-3 font-bold ${scoreColorClass(score)}`}>
                          {score === null ? '—' : `${score}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-6">
        {(selectedAreaId || selectedThemeId) && filteredQuestions.length === 0 && (
          <p className="text-center text-xs text-slate-500 italic py-4">Nenhuma questão para este filtro.</p>
        )}
        {filteredQuestions.map((q, idx) => {
          const key = answerKeys[q.originalQuestionId];
          const qStats = stats[q.id];
          const accuracyPercent = qStats && qStats.totalAnswered > 0
            ? Math.round((qStats.totalCorrect / qStats.totalAnswered) * 100)
            : null;

          return (
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Questão {idx + 1}
                  </span>
                  {sourceExamById[q.originalQuestionId] && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceExamChipClass(sourceExamById[q.originalQuestionId])}`}>
                      {sourceExamById[q.originalQuestionId]}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {accuracyPercent !== null && (
                    <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-current/30 bg-current/10 flex items-center gap-1 ${scoreColorClass(accuracyPercent)}`}>
                      <BarChart3 className="w-3 h-3" />
                      {accuracyPercent}% de acerto
                      <span className="flex items-center gap-0.5 font-normal normal-case text-[10px] opacity-80">
                        <Users className="w-3 h-3" />({qStats!.totalAnswered})
                      </span>
                    </span>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => handleDeleteQuestion(q)}
                      disabled={removingQuestionId === q.id}
                      title="Remover questão desta prova"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-line mb-4">
                {q.statement}
              </p>

              {q.imageUrl && <QuestionImage src={q.imageUrl} allowZoom={false} />}

              <div className="space-y-2 mt-2">
                {(['A', 'B', 'C', 'D'] as const).map((altKey) => {
                  const text = q.alternatives[altKey];
                  if (!text) return null;
                  const isCorrectKey = key?.correctAlternative === altKey;

                  return (
                    <div
                      key={altKey}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                        isCorrectKey
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-[#050f41] font-semibold'
                          : 'bg-slate-950 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                        isCorrectKey ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {altKey}
                      </div>
                      <span className="leading-relaxed flex-1">{text}</span>
                      {isCorrectKey && <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0">Gabarito</span>}
                    </div>
                  );
                })}
              </div>

              {key && (key.comments || key.commentMediaUrl || key.correctAlternative) && (
                <div className="mt-4 rounded-xl bg-teal-500/10 border border-teal-500/30 overflow-hidden">
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
                    <div className="px-4 pb-4 text-xs text-slate-300 space-y-2">
                      {key.correctAlternative && (
                        <p className="font-bold text-teal-400">GABARITO: {key.correctAlternative}</p>
                      )}
                      {key.comments && (
                        <p className="text-slate-300 leading-relaxed mt-4">{key.comments}</p>
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
      </section>
    </div>
  );
};
