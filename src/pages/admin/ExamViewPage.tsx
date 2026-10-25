import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, BarChart3, Users, Power, PowerOff, Trash2, Pencil, Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Layers, MapPin, X, Send, PhoneOff, UserPlus, FileText, Download, Loader2, ArrowUp } from 'lucide-react';
import { getExamById, getExamQuestions, getQuestionAnswer, getExamQuestionStats, updateExamActiveStatus, isExamActive, getQuestionsByIds, getAttemptsForExam, subscribeAttemptsForExam, updateExamContent, syncExamQuestionFromBank, getAttemptAnswers, getAreas, getThemes, getReferences, createNotification, getExamAssignmentsWithUsers, markAssignmentInvited, addExamAssignments, getActiveUsers } from '../../services/firebaseService';
import { Exam, ExamQuestion, QuestionAnswer, Question, Attempt, Area, Reference, ExamAssignment, AppUser, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { QuestionFormModal, SavedAnswerFields } from '../../components/QuestionFormModal';
import { AddQuestionImageModal } from '../../components/AddQuestionImageModal';
import { QuestionImage } from '../../components/QuestionImage';
import { CommentMedia } from '../../components/CommentMedia';
import { ReferenceSource } from '../../components/ReferenceSource';
import { CheckboxMultiSelect } from '../../components/CheckboxMultiSelect';
import { getSourceExamChipClass, getSourceExamDisplayGroup } from '../../constants';
import { useAccess } from '../../hooks/useAccess';
import { generateExamPdfForAdmin, viewExamReportPdf } from '../../services/examReportService';
import { scoreColorClass, buildWhatsAppLink } from '../../utils/helpers';
import { isResidentRole, cohortOfRole, COHORT_LABEL, ResidentCohort } from '../../utils/cohort';

interface SubmittedRow {
  attempt: Attempt;
  areaScores: Record<string, number | null>; // areaId -> percentage (null = sem questões dessa área nessa tentativa)
}

const PIE_COLORS = ['#2C3A47', '#2F9C8C', '#2F9C8C', '#079551', '#a855f7', '#f472b6', '#f97316', '#10b981', '#6366f1', '#C7362F'];

// Tabelas "Áreas da Prova", "Temas da Prova" e "Distribuição por fonte" paginadas, 5 linhas por página.
const ROWS_PER_PAGE = 5;

export const ExamViewPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { currentUser } = useAuth();
  const { isReader, basePath } = useAccess();
  const [exam, setExam] = useState<Exam | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Mobile: botões flutuantes de voltar/topo só aparecem depois de rolar.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 240);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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
  // Questão (do banco) aberta no modal de edição — vale para o banco e para
  // esta prova (ver handleQuestionEdited).
  const [editingQuestion, setEditingQuestion] = useState<{ examQuestionId: string; question: Question } | null>(null);
  // Questão sem imagem que está recebendo uma (modal AddQuestionImageModal).
  const [addingImageFor, setAddingImageFor] = useState<{ examQuestionId: string; question: Question } | null>(null);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  // Tabela "Respostas Enviadas" — uma linha completada por tentativa
  // concluída, com o desempenho por área derivado das respostas individuais.
  const [submittedRows, setSubmittedRows] = useState<SubmittedRow[]>([]);
  // Candidatos atribuídos a esta prova, para a seção "Convidar Candidatos"
  // (botão de envio de convite por WhatsApp com o link direto do assignment).
  const [assignments, setAssignments] = useState<(ExamAssignment & { userName: string; userPhone?: string; userRole?: UserRole })[]>([]);
  // "Adicionar Candidatos" — usuários ativos ainda não atribuídos a esta
  // prova, para incluí-los mesmo depois dela já elaborada/publicada.
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [selectedNewUserIds, setSelectedNewUserIds] = useState<string[]>([]);
  const [addingCandidates, setAddingCandidates] = useState(false);
  const [examAreas, setExamAreas] = useState<Area[]>([]);
  const [allAreasList, setAllAreasList] = useState<Area[]>([]);
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
  // Filtro por fonte (tabela "Distribuição por fonte") — restringe só a lista
  // de questões; área e tema continuam restringindo a própria tabela de fontes.
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  // Mesmo gate usado em CreateExamPage/updateExamContent: só é possível
  // mexer nas questões de uma prova inativa e sem tentativas registradas.
  // Derivado a cada render (em vez de um estado próprio) para não ficar
  // desatualizado quando o admin ativa/desativa a prova nesta mesma tela
  // (handleToggleActive) — antes disso, o botão de excluir podia continuar
  // visível mesmo depois de a prova ser ativada, causando o erro "Só é
  // possível editar provas inativas." ao clicar.
  const canEdit = !isReader && !!exam && !isExamActive(exam) && !exam.editLocked && !hasAttempts;

  // Usuários ativos que ainda não têm assignment nesta prova — opções do
  // seletor de "Adicionar Candidatos".
  const unassignedActiveUsers = useMemo(() => {
    const assignedUserIds = new Set(assignments.map(a => a.userId));
    return activeUsers.filter(u => !assignedUserIds.has(u.id));
  }, [activeUsers, assignments]);

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

  // 3ª tabela "Distribuição por fonte": BANCO PRÓPRIO, TEOT e TARO (os dois
  // últimos agrupam todos os anos), só com os grupos que têm questões, restrita
  // aos filtros de área e tema (se houver). `sourceExam` vem do banco
  // (sourceExamById), não da cópia congelada da prova.
  const sourceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      if (selectedAreaId && q.areaId !== selectedAreaId) return;
      if (selectedThemeId && q.themeId !== selectedThemeId) return;
      const source = getSourceExamDisplayGroup(sourceExamById[q.originalQuestionId]);
      if (!source) return;
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  }, [questions, sourceExamById, selectedAreaId, selectedThemeId]);

  // Questões exibidas abaixo, restritas pelos mesmos filtros cruzados.
  const filteredQuestions = useMemo(() => questions.filter(q => (
    (!selectedAreaId || q.areaId === selectedAreaId) &&
    (!selectedThemeId || q.themeId === selectedThemeId) &&
    (!selectedSource || getSourceExamDisplayGroup(sourceExamById[q.originalQuestionId]) === selectedSource)
  )), [questions, selectedAreaId, selectedThemeId, selectedSource, sourceExamById]);

  const handleAreaClick = (areaId: string) => {
    setSelectedAreaId(prev => (prev === areaId ? null : areaId));
    setSelectedThemeId(null);
    setSelectedSource(null);
  };

  const handleThemeClick = (themeId: string) => {
    setSelectedThemeId(prev => (prev === themeId ? null : themeId));
    setSelectedSource(null);
  };

  const handleSourceClick = (source: string) => {
    setSelectedSource(prev => (prev === source ? null : source));
  };

  const clearFilters = () => {
    setSelectedAreaId(null);
    setSelectedThemeId(null);
    setSelectedSource(null);
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

  const [sourceTablePage, setSourceTablePage] = useState(1);
  const sourceTableTotalPages = Math.max(1, Math.ceil(sourceDistribution.length / ROWS_PER_PAGE));
  const paginatedSources = useMemo(() => {
    const start = (sourceTablePage - 1) * ROWS_PER_PAGE;
    return sourceDistribution.slice(start, start + ROWS_PER_PAGE);
  }, [sourceDistribution, sourceTablePage]);

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
    setSourceTablePage(1);
  }, [selectedAreaId, selectedThemeId, examId]);
  useEffect(() => {
    if (sourceTablePage > sourceTableTotalPages) setSourceTablePage(sourceTableTotalPages);
  }, [sourceTablePage, sourceTableTotalPages]);
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
        // Leitor não vê candidatos/convites/respostas — não carrega esses dados.
        const [examData, examQs, questionStats, attempts, allAreas, allThemes, refList, assignmentList, activeUserList] = await Promise.all([
          getExamById(examId),
          getExamQuestions(examId),
          getExamQuestionStats(examId),
          isReader ? Promise.resolve([] as Attempt[]) : getAttemptsForExam(examId),
          getAreas(),
          getThemes(),
          getReferences(),
          isReader ? Promise.resolve([] as (ExamAssignment & { userName: string; userPhone?: string })[]) : getExamAssignmentsWithUsers(examId),
          isReader ? Promise.resolve([] as AppUser[]) : getActiveUsers()
        ]);
        setExam(examData);
        setQuestions(examQs);
        setStats(questionStats);
        setHasAttempts(attempts.length > 0);
        setReferences(refList);
        setAssignments(assignmentList);
        // O admin não realiza provas — nunca deve aparecer como candidato.
        setActiveUsers(activeUserList.filter(u => isResidentRole(u.role)));

        // Áreas presentes nesta prova (colunas da tabela de respostas
        // enviadas), na mesma ordem de getAreas() (alfabética).
        const areaIdsInExam = new Set(examQs.map(q => q.areaId));
        setExamAreas(allAreas.filter(a => areaIdsInExam.has(a.id)));
        setAllAreasList(allAreas);

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
    if (!examId || questions.length === 0 || isReader) return;
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
  // confirma o envio dentro do próprio WhatsApp antes de disparar. Marca o
  // convite como enviado (invitedAt) tanto no Firestore quanto localmente,
  // para contabilizar na coluna "Convites" de ExamsListPage e mostrar
  // "Convidado" nesta tabela.
  const handleSendInvite = (assignment: ExamAssignment & { userName: string; userPhone?: string; userRole?: UserRole }) => {
    if (!exam || !assignment.userPhone || assignment.status !== 'available') return;
    const link = `${window.location.origin}/app/exams/${assignment.id}`;
    const cohortLabel = COHORT_LABEL[cohortOfRole(assignment.userRole) ?? 'hma'];
    const message = `*TEOT ${cohortLabel} 2027:*\n\n${assignment.userName}, a prova ${exam.name} está disponível para você.\n\nAcesse : ${link}`;
    window.open(buildWhatsAppLink(assignment.userPhone, message), '_blank', 'noopener,noreferrer');

    markAssignmentInvited(assignment.id).catch(err => console.error('Erro ao registrar convite enviado:', err));
    setAssignments(prev => prev.map(a => (a.id === assignment.id ? { ...a, invitedAt: new Date() } : a)));
  };

  // Atribui a prova (já publicada) a candidatos adicionais escolhidos entre
  // os usuários ativos ainda não atribuídos (ver unassignedActiveUsers).
  const handleAddCandidates = async () => {
    if (!exam || selectedNewUserIds.length === 0) return;
    setAddingCandidates(true);
    try {
      await addExamAssignments(exam.id, selectedNewUserIds);
      const updated = await getExamAssignmentsWithUsers(exam.id);
      setAssignments(updated);
      setSelectedNewUserIds([]);
    } catch (err: any) {
      alert("Erro ao adicionar candidatos: " + (err?.message || "erro desconhecido."));
    } finally {
      setAddingCandidates(false);
    }
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
          actorName: currentUser.name,
          // Só avisa os grupos que têm candidatos nesta prova.
          targetCohorts: Array.from(new Set(
            assignments.map(a => cohortOfRole(a.userRole)).filter((c): c is ResidentCohort => !!c)
          ))
        }).catch(err => console.error('Erro ao criar notificação de ativação de prova:', err));
      }
    } catch (err: any) {
      alert("Erro ao alterar status da prova: " + (err?.message || "erro desconhecido."));
    } finally {
      setToggling(false);
    }
  };

  // Depois que o modal grava a questão no banco, replica a edição na cópia
  // congelada desta prova e atualiza o que a tela mostra.
  const handleQuestionEdited = async (saved: Question, answer: SavedAnswerFields) => {
    if (!exam || !editingQuestion) return;
    await syncExamQuestionFromBank(exam.id, editingQuestion.examQuestionId, saved);

    const updatedQuestions = questions.map(q => q.id === editingQuestion.examQuestionId
      ? { ...q, areaId: saved.areaId, themeId: saved.themeId, statement: saved.statement, alternatives: saved.alternatives, imageUrl: saved.imageUrl }
      : q);
    setQuestions(updatedQuestions);
    setOriginalQuestionsById(prev => ({ ...prev, [saved.id]: saved }));
    setSourceExamById(prev => ({ ...prev, [saved.id]: saved.sourceExam }));
    setAnswerKeys(prev => ({ ...prev, [saved.id]: { ...(prev[saved.id] || { questionId: saved.id }), ...answer } as QuestionAnswer }));
    // Área/tema podem ter mudado: mantém os rótulos e colunas coerentes.
    const [allAreas, allThemes] = await Promise.all([getAreas(), getThemes()]);
    setAreaNameById(Object.fromEntries(allAreas.map(a => [a.id, a.name])));
    setThemeNameById(Object.fromEntries(allThemes.map(t => [t.id, t.name])));
    setAllAreasList(allAreas);
    const areaIdsInExam = new Set(updatedQuestions.map(q => q.areaId));
    setExamAreas(allAreas.filter(a => areaIdsInExam.has(a.id)));
  };

  // O modal de imagem já grava a imagem no banco (addQuestionImage); aqui
  // replica na cópia congelada desta prova e atualiza a tela.
  const handleImageAdded = async (imageUrl: string) => {
    if (!exam || !addingImageFor) return;
    const updated: Question = { ...addingImageFor.question, imageUrl };
    try {
      await syncExamQuestionFromBank(exam.id, addingImageFor.examQuestionId, updated);
    } catch (err: any) {
      alert("A imagem foi salva no banco de questões, mas não foi possível aplicá-la a esta prova: " + (err?.message || "erro desconhecido."));
      return;
    }
    setQuestions(prev => prev.map(q => q.id === addingImageFor.examQuestionId ? { ...q, imageUrl } : q));
    setOriginalQuestionsById(prev => ({ ...prev, [updated.id]: updated }));
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

  // PDF da prova (versão preceptor): abre o já salvo ou gera no servidor —
  // gerar numa prova editável a deixa travada (ver generateExamPdf).
  const handleExamPdf = async () => {
    if (!exam) return;
    if (exam.pdfUrl) {
      viewExamReportPdf(exam.pdfUrl);
      return;
    }
    if (canEdit && !window.confirm(
      'Gerar o PDF desta prova vai TRAVAR a edição dela (conteúdo congelado). Deseja continuar?'
    )) return;
    setPdfBusy(true);
    try {
      const { url, fileName } = await generateExamPdfForAdmin(exam.id);
      setExam({ ...exam, pdfUrl: url, pdfFileName: fileName, editLocked: exam.editLocked || canEdit });
      viewExamReportPdf(url);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível gerar o PDF da prova.');
    } finally {
      setPdfBusy(false);
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
        <Link to={basePath + '/exams'} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Provas</span>
        </Link>
        <p className="text-sm text-slate-400">Prova não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link to={basePath + '/exams'} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Provas</span>
        </Link>
        {/* Desktop: botão de PDF no topo à direita. */}
        <button
          type="button"
          onClick={handleExamPdf}
          disabled={pdfBusy}
          title={exam.pdfUrl ? 'Ver PDF da prova' : 'Gerar PDF da prova'}
          aria-label={exam.pdfUrl ? 'Ver PDF da prova' : 'Gerar PDF da prova'}
          className={`${isReader && !exam.pdfUrl ? 'hidden' : 'hidden sm:inline-flex'} p-2 rounded-lg border disabled:opacity-60 ${exam.pdfUrl ? 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10' : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'}`}
        >
          {pdfBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : exam.pdfUrl ? <Download className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile: botões flutuantes (PDF fixo no canto superior direito;
          voltar à lista e voltar ao topo aparecem ao rolar). */}
      <button
        type="button"
        onClick={handleExamPdf}
        disabled={pdfBusy}
        aria-label={exam.pdfUrl ? 'Ver PDF da prova' : 'Gerar PDF da prova'}
        className={`${isReader && !exam.pdfUrl ? 'hidden' : 'sm:hidden'} fixed top-[4.5rem] right-4 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border bg-slate-900 disabled:opacity-60 ${exam.pdfUrl ? 'text-emerald-400 border-emerald-500/40' : 'text-slate-300 border-slate-700'}`}
      >
        {pdfBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : exam.pdfUrl ? <Download className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
      </button>
      <Link
        to={basePath + '/exams'}
        aria-label="Voltar para Lista de Provas"
        className={`sm:hidden fixed top-[4.5rem] left-4 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border border-slate-700 bg-slate-900 text-slate-200 transition-opacity ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Voltar ao topo"
        className={`sm:hidden fixed bottom-24 right-4 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border border-slate-700 bg-slate-900 text-slate-200 transition-opacity ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">{exam.name}</h1>
          {!isReader && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            isExamActive(exam)
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isExamActive(exam) ? 'Ativa' : 'Inativa'}
          </span>
          )}
        </div>

        {!isReader && (
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
        )}
      </div>

      {!isReader && (
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-cyan-400" />
          Adicionar Candidatos
        </h2>
        <p className="text-xs text-slate-400 -mt-1">
          Inclua outros usuários ativos para realizar esta prova, mesmo já elaborada.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <CheckboxMultiSelect
            className="flex-1"
            label="Candidato"
            options={unassignedActiveUsers.map(u => {
              const cohort = cohortOfRole(u.role);
              return { id: u.id, label: cohort ? `${u.name} · ${COHORT_LABEL[cohort]}` : u.name };
            })}
            selectedIds={selectedNewUserIds}
            onChange={setSelectedNewUserIds}
            emptyLabel={unassignedActiveUsers.length === 0 ? 'Todos os usuários ativos já foram atribuídos' : 'Selecione candidatos'}
            disabled={unassignedActiveUsers.length === 0}
          />
          <button
            type="button"
            onClick={handleAddCandidates}
            disabled={selectedNewUserIds.length === 0 || addingCandidates}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {addingCandidates ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
        {/* Atalho de seleção em lote: todos os residentes ainda não
            atribuídos de um grupo (HMA/HNMD) de uma vez. */}
        {unassignedActiveUsers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Selecionar grupo inteiro:</span>
            {(['hma', 'hnmd'] as ResidentCohort[]).map(cohort => {
              const ids = unassignedActiveUsers.filter(u => cohortOfRole(u.role) === cohort).map(u => u.id);
              const allSelected = ids.length > 0 && ids.every(id => selectedNewUserIds.includes(id));
              return (
                <button
                  key={cohort}
                  type="button"
                  disabled={ids.length === 0}
                  onClick={() => setSelectedNewUserIds(prev => allSelected
                    ? prev.filter(id => !ids.includes(id))
                    : Array.from(new Set([...prev, ...ids])))}
                  className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    allSelected
                      ? 'bg-cyan-500/15 text-cyan-500 border-cyan-500/40'
                      : 'text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {COHORT_LABEL[cohort]} ({ids.length})
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

      {!isReader && isExamActive(exam) && assignments.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
                  const statusMeta = a.status === 'started'
                    ? { label: 'Em andamento', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
                    : a.status === 'completed'
                      ? { label: 'Concluída', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                      : a.invitedAt
                        ? { label: 'Convidado', className: 'bg-cyan-500/20 text-cyan-600 border-cyan-500/30' }
                        : { label: 'Disponível', className: 'bg-slate-800 text-slate-300 border-slate-700' };
                  return (
                    <tr key={a.id}>
                      <td className="p-3 font-semibold text-slate-100">{a.userName}</td>
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

      {!isReader && submittedRows.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
                    <td className="p-3 font-semibold text-slate-100">{attempt.userName || '—'}</td>
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

      {/* Cards de distribuição fixos à esquerda; as questões rolam à direita. */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {areaDistribution.length > 0 && (
        <aside className="lg:w-80 xl:w-96 shrink-0 space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          {(selectedAreaId || selectedThemeId || selectedSource) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Filtrando por:</span>
              {selectedAreaId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 font-semibold">
                  {areaNameById[selectedAreaId] || 'Área'}
                </span>
              )}
              {selectedThemeId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 font-semibold">
                  {themeNameById[selectedThemeId] || 'Tema'}
                </span>
              )}
              {selectedSource && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 font-semibold">
                  {selectedSource}
                </span>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 font-semibold"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            </div>
          )}

          <div className="space-y-4">
            {/* Áreas da Prova — raiz do filtro cruzado. Os 3 cards ficam empilhados
                numa coluna fixa (sticky) ao lado da lista de questões. */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
                          <td className="p-3 font-semibold text-slate-100 flex items-center gap-2">
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

            {/* Distribuição por fonte — filtrada por área/tema selecionados; clicar numa linha filtra as questões. 3/7 da largura no desktop. */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Distribuição por fonte
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Fonte</th>
                      <th className="p-3">Questões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paginatedSources.map((s) => {
                      const idx = sourceDistribution.indexOf(s);
                      const isSelected = selectedSource === s.source;
                      return (
                        <tr
                          key={s.source}
                          onClick={() => handleSourceClick(s.source)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className="p-3 font-semibold text-slate-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="truncate">{s.source}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-300">{s.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {sourceTableTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSourceTablePage(p => Math.max(1, p - 1))}
                    disabled={sourceTablePage === 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Anterior
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Página <strong className="text-slate-200">{sourceTablePage}</strong> de {sourceTableTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSourceTablePage(p => Math.min(sourceTableTotalPages, p + 1))}
                    disabled={sourceTablePage === sourceTableTotalPages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* Temas da Prova — filtrado pela área selecionada, se houver. 2/7 da largura no desktop. */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
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
                          <td className="p-3 font-semibold text-slate-100 flex items-center gap-2">
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
          </div>
        </aside>
      )}
      <section className="flex-1 min-w-0 space-y-6">
        {(selectedAreaId || selectedThemeId || selectedSource) && filteredQuestions.length === 0 && (
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

                  {canEdit && originalQuestionsById[q.originalQuestionId] && !q.imageUrl && (
                    <button
                      onClick={() => setAddingImageFor({ examQuestionId: q.id, question: originalQuestionsById[q.originalQuestionId] })}
                      title="Adicionar imagem (banco de questões e esta prova)"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canEdit && originalQuestionsById[q.originalQuestionId] && (
                    <button
                      onClick={() => setEditingQuestion({ examQuestionId: q.id, question: originalQuestionsById[q.originalQuestionId] })}
                      title="Editar questão (banco de questões e esta prova)"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-slate-100 font-semibold'
                          : 'bg-slate-950 border-slate-800/80 text-slate-100'
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
      </section>
      </div>

      {addingImageFor && (
        <AddQuestionImageModal
          questionId={addingImageFor.question.id}
          onClose={() => setAddingImageFor(null)}
          onSaved={handleImageAdded}
        />
      )}

      {editingQuestion && (
        <QuestionFormModal
          key={editingQuestion.question.id}
          question={editingQuestion.question}
          areas={allAreasList}
          onClose={() => setEditingQuestion(null)}
          onSaved={handleQuestionEdited}
        />
      )}
    </div>
  );
};
