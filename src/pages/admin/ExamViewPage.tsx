import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, BarChart3, Users, Power, PowerOff, Trash2, ChevronDown } from 'lucide-react';
import { getExamById, getExamQuestions, getQuestionAnswer, getExamQuestionStats, updateExamActiveStatus, isExamActive, getQuestionsByIds, getAttemptsForExam, updateExamContent } from '../../services/firebaseService';
import { Exam, ExamQuestion, QuestionAnswer, Question } from '../../types';
import { QuestionImage } from '../../components/QuestionImage';
import { CommentMedia } from '../../components/CommentMedia';
import { getSourceExamChipClass } from '../../constants';
import { scoreColorClass } from '../../utils/helpers';

export const ExamViewPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
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
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  // Se a prova tem alguma tentativa registrada — não muda depois do
  // carregamento inicial (uma vez que existe uma tentativa, ela nunca some).
  const [hasAttempts, setHasAttempts] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  // Mesmo gate usado em CreateExamPage/updateExamContent: só é possível
  // mexer nas questões de uma prova inativa e sem tentativas registradas.
  // Derivado a cada render (em vez de um estado próprio) para não ficar
  // desatualizado quando o admin ativa/desativa a prova nesta mesma tela
  // (handleToggleActive) — antes disso, o botão de excluir podia continuar
  // visível mesmo depois de a prova ser ativada, causando o erro "Só é
  // possível editar provas inativas." ao clicar.
  const canEdit = !!exam && !isExamActive(exam) && !hasAttempts;

  useEffect(() => {
    async function loadExam() {
      if (!examId) return;
      try {
        setLoading(true);
        const [examData, examQs, questionStats, attempts] = await Promise.all([
          getExamById(examId),
          getExamQuestions(examId),
          getExamQuestionStats(examId),
          getAttemptsForExam(examId)
        ]);
        setExam(examData);
        setQuestions(examQs);
        setStats(questionStats);
        setHasAttempts(attempts.length > 0);

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

  const handleToggleActive = async () => {
    if (!exam) return;
    setToggling(true);
    try {
      const nextActive = !isExamActive(exam);
      await updateExamActiveStatus(exam.id, nextActive);
      setExam({ ...exam, active: nextActive });
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

      <section className="space-y-6">
        {questions.map((q, idx) => {
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
