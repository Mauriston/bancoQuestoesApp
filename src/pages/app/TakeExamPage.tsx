import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, X, ZoomIn, Send, Trophy, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExamById, getExamQuestions, startExamAttempt, getAttemptAnswers,
  saveAttemptAnswer, getUserAssignments, isExamActive
} from '../../services/firebaseService';
import { finishAndGradeAttempt } from '../../services/gradingService';
import { Exam, ExamQuestion } from '../../types';

export const TakeExamPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string>('');
  const [currentAlt, setCurrentAlt] = useState<"A" | "B" | "C" | "D" | null>(null);
  // Mapa examQuestionId → alternativa salva (mesmo para questões que ainda
  // não foram visitadas nesta sessão do navegador). Usado para contar o
  // progresso e, principalmente, para hidratar currentAlt sempre que o índice
  // muda — cobre tanto a retomada quanto tentativas antigas que possam ter
  // lacunas não-contíguas, sem depender de currentIndex sempre avançar em
  // ordem estritamente crescente sobre dados 100% "limpos".
  const [savedAlt, setSavedAlt] = useState<Record<string, "A" | "B" | "C" | "D" | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null | undefined>(null);

  useEffect(() => {
    async function initExam() {
      if (!assignmentId || !currentUser) return;
      try {
        setLoading(true);
        setLoadError(null);
        const allAssignments = await getUserAssignments(currentUser.id);
        const asgn = allAssignments.find(a => a.id === assignmentId);
        if (!asgn) throw new Error("Atribuição de prova não encontrada");

        const examData = await getExamById(asgn.examId);
        if (!examData) throw new Error("Dados da prova não encontrados");

        // Uma prova desativada pelo admin não pode ser iniciada — mas quem
        // já estava em andamento ('started') não é interrompido.
        if (asgn.status === 'available' && !isExamActive(examData)) {
          throw new Error("Esta prova não está mais disponível no momento.");
        }

        setExam(examData);

        const { attemptId: attId, examQuestions } = await startExamAttempt(
          assignmentId,
          currentUser.id,
          asgn.examId
        );

        setAttemptId(attId);
        setQuestions(examQuestions);

        // Retomando uma tentativa em andamento: avança automaticamente para
        // a primeira questão ainda não respondida (não é possível voltar).
        const savedAns = await getAttemptAnswers(attId);
        const altMap: Record<string, "A" | "B" | "C" | "D" | null> = {};
        savedAns.forEach(a => { altMap[a.examQuestionId] = a.selectedAlternative; });
        setSavedAlt(altMap);

        const firstUnanswered = examQuestions.findIndex(q => !altMap[q.id]);
        const resumeIndex = firstUnanswered === -1 ? examQuestions.length - 1 : firstUnanswered;
        setCurrentIndex(resumeIndex);
        setCurrentAlt(altMap[examQuestions[resumeIndex]?.id] ?? null);

      } catch (err: any) {
        console.error("Erro ao iniciar prova:", err);
        setLoadError(err?.message || "Não foi possível carregar esta prova.");
      } finally {
        setLoading(false);
      }
    }
    initExam();
  }, [assignmentId, currentUser]);

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleSelectOption = (alt: "A" | "B" | "C" | "D") => {
    setCurrentAlt(prev => (prev === alt ? null : alt));
  };

  const handleAdvance = async () => {
    // A prova não pode ser finalizada com questões sem resposta. Como não é
    // possível voltar a uma questão anterior, a forma correta de garantir
    // isso é nunca permitir avançar da questão atual sem uma alternativa
    // selecionada — inclusive na última, onde "avançar" é abrir a
    // confirmação de envio.
    if (!currentQ || !attemptId || submitting || currentAlt === null) return;
    setSubmitting(true);
    try {
      await saveAttemptAnswer(
        attemptId,
        currentQ.id,
        currentQ.originalQuestionId,
        currentAlt,
        currentQ.areaId,
        currentQ.themeId
      );
      setSavedAlt(prev => ({ ...prev, [currentQ.id]: currentAlt }));

      if (isLastQuestion) {
        setFinishModalOpen(true);
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setCurrentAlt(savedAlt[questions[nextIndex]?.id] ?? null);
      }
    } catch (e) {
      console.error("Erro ao salvar resposta no banco:", e);
      alert("Ocorreu um erro ao salvar sua resposta. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishExam = async () => {
    if (submitting || !attemptId) return;
    setSubmitting(true);
    setFinishModalOpen(false);

    try {
      await finishAndGradeAttempt(attemptId);
      navigate(`/app/attempts/${attemptId}/result`);
    } catch (err) {
      console.error("Erro ao finalizar prova:", err);
      alert("Ocorreu um erro ao enviar sua prova. Tente novamente.");
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center py-20 text-slate-400 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-200 font-semibold">{loadError}</p>
        <Link to="/app/exams" className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Minhas Provas</span>
        </Link>
      </div>
    );
  }

  if (loading || !currentQ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Iniciando ambiente seguro da prova...</p>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">

      {/* Top: ícone do app + nome da prova + contador de questão (economiza espaço vertical) */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur flex items-center justify-between gap-2.5 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-[#050f41] leading-tight truncate">
            {exam?.name || 'Simulado Ortopedia'}
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
          Questão {currentIndex + 1}/{questions.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
        <div
          className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Content Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">

        {/* Enunciado */}
        <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
          {currentQ.statement}
        </p>

        {/* Image Preview se houver */}
        {currentQ.imageUrl && (
          <div className="mb-6 p-3 rounded-2xl bg-slate-950 border border-slate-800 inline-block max-w-md">
            <div className="relative group cursor-pointer" onClick={() => setPreviewImageUrl(currentQ.imageUrl)}>
              <img
                src={currentQ.imageUrl}
                alt="Imagem da questão"
                className="rounded-xl max-h-72 w-auto object-contain mx-auto"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-[#050f41]/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
                <ZoomIn className="w-4 h-4" />
                <span>Clique para ampliar</span>
              </div>
            </div>
          </div>
        )}

        {/* Alternativas */}
        <div className="space-y-3">
          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const text = currentQ.alternatives[letter];
            if (!text) return null;
            const isSelected = currentAlt === letter;

            return (
              <button
                key={letter}
                onClick={() => handleSelectOption(letter)}
                className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all ${
                  isSelected
                    ? 'bg-teal-500/15 border-teal-500/60 text-[#050f41] shadow-md shadow-teal-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-[#050f41]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {letter}
                </div>
                <span className="text-sm sm:text-base leading-relaxed font-normal flex-1">{text}</span>
              </button>
            );
          })}
        </div>

        {/* Avançar (sem opção de voltar; exige resposta selecionada) — botão
            reduzido a ícone para economizar espaço vertical no mobile. */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={handleAdvance}
            disabled={submitting || currentAlt === null}
            title={isLastQuestion ? 'Revisar e Finalizar' : 'Próxima Questão'}
            aria-label={isLastQuestion ? 'Revisar e Finalizar' : 'Próxima Questão'}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-teal-600/20"
          >
            {isLastQuestion ? <Send className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Modal de Imagem */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-[#050f41]/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-[#050f41] p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewImageUrl} alt="Imagem Ampliada" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}

      {/* Confirmação de Término */}
      {finishModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#050f41]">Finalizar Prova?</h3>
                <p className="text-sm text-slate-400">Essa foi a última questão. Confirme o envio definitivo das suas respostas.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 space-y-1">
              <p>✔ Todas as <strong className="text-teal-400">{questions.length}</strong> questões foram respondidas.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setFinishModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
              >
                Ajustar Última Resposta
              </button>
              <button
                onClick={handleFinishExam}
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20"
              >
                {submitting ? 'Enviando...' : 'Confirmar e Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
