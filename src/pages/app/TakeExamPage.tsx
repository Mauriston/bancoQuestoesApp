import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, X, ZoomIn, Trophy, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExamById, getExamQuestions, startExamAttempt, getAttemptAnswers,
  saveAttemptAnswer, getUserAssignments, isExamActive, createNotification
} from '../../services/firebaseService';
import { finishAndGradeAttempt } from '../../services/gradingService';
import { Exam, ExamQuestion } from '../../types';

// Cache local (por navegador/dispositivo) da alternativa selecionada na
// questão atual, ainda NÃO confirmada em Firestore (isso só acontece ao
// clicar "Avançar" — ver handleAdvance). Sem isso, um refresh de página,
// queda de internet ou fechamento acidental da aba entre a seleção e o
// clique em avançar perderia essa escolha, mesmo a tentativa continuando
// 'in_progress' e retomável. Respostas já confirmadas continuam vindo de
// Firestore (getAttemptAnswers) — este cache cobre só o "rascunho" da
// questão em que o residente parou.
const DRAFT_KEY_PREFIX = 'teot_exam_draft_';

type AltValue = "A" | "B" | "C" | "D";

function loadDraft(attemptId: string): Record<string, AltValue> {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}${attemptId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDraft(attemptId: string, examQuestionId: string, alt: AltValue | null) {
  try {
    const draft = loadDraft(attemptId);
    if (alt === null) {
      delete draft[examQuestionId];
    } else {
      draft[examQuestionId] = alt;
    }
    localStorage.setItem(`${DRAFT_KEY_PREFIX}${attemptId}`, JSON.stringify(draft));
  } catch {
    // localStorage indisponível (modo privado, quota cheia etc.) — degrada
    // silenciosamente para o comportamento sem cache local de rascunho.
  }
}

function clearDraft(attemptId: string) {
  try {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${attemptId}`);
  } catch {
    // ignore
  }
}

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
  const [finishing, setFinishing] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null | undefined>(null);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);

  const loadingTips = [
    'Não é possível retornar a uma questão já respondida',
    'Clique nas imagens das questões para ampliá-las',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingTipIndex(prev => (prev + 1) % loadingTips.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

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

        // Nenhuma resposta salva ainda == esta é a primeira vez que o
        // residente abre esta tentativa (não uma retomada) — só nesse caso
        // dispara a notificação de início.
        if (savedAns.length === 0) {
          createNotification({
            type: 'exam_started',
            message: `${currentUser.name} iniciou a prova ${examData.name}`,
            audience: 'all',
            actorId: currentUser.id,
            actorName: currentUser.name
          }).catch(err => console.error('Erro ao criar notificação de início de prova:', err));
        }

        const firstUnanswered = examQuestions.findIndex(q => !altMap[q.id]);
        const resumeIndex = firstUnanswered === -1 ? examQuestions.length - 1 : firstUnanswered;
        setCurrentIndex(resumeIndex);

        // A questão em que o residente parou pode ter uma alternativa
        // selecionada mas ainda não confirmada (não chegou a clicar
        // "Avançar") — recupera esse rascunho do cache local, se houver.
        const resumeQuestionId = examQuestions[resumeIndex]?.id;
        const draft = resumeQuestionId ? loadDraft(attId) : {};
        setCurrentAlt(
          (resumeQuestionId ? altMap[resumeQuestionId] : null) ??
          (resumeQuestionId ? draft[resumeQuestionId] : null) ??
          null
        );

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
    setCurrentAlt(prev => {
      const next = prev === alt ? null : alt;
      if (currentQ && attemptId) saveDraft(attemptId, currentQ.id, next);
      return next;
    });
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
      // Resposta confirmada em Firestore — o rascunho local desta questão
      // não é mais necessário.
      saveDraft(attemptId, currentQ.id, null);

      if (isLastQuestion) {
        await handleFinishExam();
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        const nextQuestionId = questions[nextIndex]?.id;
        const draft = nextQuestionId ? loadDraft(attemptId) : {};
        setCurrentAlt(
          (nextQuestionId ? savedAlt[nextQuestionId] : null) ??
          (nextQuestionId ? draft[nextQuestionId] : null) ??
          null
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      console.error("Erro ao salvar resposta no banco:", e);
      alert("Ocorreu um erro ao salvar sua resposta. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishExam = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    setFinishing(true);

    try {
      await finishAndGradeAttempt(attemptId);
      clearDraft(attemptId);
      if (currentUser && exam) {
        createNotification({
          type: 'exam_completed',
          message: `${currentUser.name} concluiu a prova ${exam.name}`,
          audience: 'all',
          actorId: currentUser.id,
          actorName: currentUser.name
        }).catch(err => console.error('Erro ao criar notificação de conclusão de prova:', err));
      }
      navigate(`/app/attempts/${attemptId}/result`);
    } catch (err) {
      console.error("Erro ao finalizar prova:", err);
      alert("Ocorreu um erro ao enviar sua prova. Tente novamente.");
      setSubmitting(false);
      setFinishing(false);
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

  if (finishing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin" />
          <Trophy className="w-6 h-6 text-teal-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">Enviando suas respostas...</p>
          <p className="text-xs text-slate-500 mt-1">Aguarde enquanto calculamos seu resultado.</p>
        </div>
      </div>
    );
  }

  if (loading || !currentQ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Iniciando ambiente seguro da prova...</p>
        <p
          key={loadingTipIndex}
          className="text-[11px] text-slate-500 mt-4 max-w-xs text-center transition-opacity duration-700 opacity-0 animate-[fadeInTip_0.7s_ease-in-out_forwards]"
        >
          {loadingTips[loadingTipIndex]}
        </p>
        <style>{`
          @keyframes fadeInTip {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 pb-24">

      {/* Top: nome da prova centralizado + indicador de progresso em pizza */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2.5 py-px">
        <div />
        <h2 className="text-base font-bold text-slate-100 leading-tight truncate text-center">
          {exam?.name || 'Simulado Ortopedia'}
        </h2>
        <div className="flex items-center justify-end shrink-0">
          <div
            className="w-8 h-8 rounded-full transition-[background] duration-300"
            style={{
              background: `conic-gradient(#1E8C7C 0deg ${progressPercent * 3.6}deg, #2C3A47 ${progressPercent * 3.6}deg 360deg)`
            }}
          />
        </div>
      </div>

      {/* Question Content Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">

        {/* Enunciado */}
        <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
          {`${currentIndex + 1}. ${currentQ.statement}`}
        </p>

        {/* Image Preview se houver — centralizada na página; clique amplia em modal */}
        {currentQ.imageUrl && (
          <div className="mb-6 flex justify-center">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 max-w-md">
              <div className="relative group cursor-pointer" onClick={() => setPreviewImageUrl(currentQ.imageUrl)}>
                <img
                  src={currentQ.imageUrl}
                  alt="Imagem da questão"
                  className="rounded-xl max-h-72 w-auto object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-slate-100/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
                  <ZoomIn className="w-4 h-4" />
                  <span>Clique para ampliar</span>
                </div>
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
                    ? 'bg-teal-500/15 border-teal-500/60 text-slate-100 shadow-md shadow-teal-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
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

      </div>

      {/* Avançar (sem opção de voltar) — FAB verde só com ícone, que só
          aparece depois que uma alternativa é selecionada; fixo no canto
          inferior direito para ficar sempre alcançável, sem ocupar espaço
          fixo no fluxo da página. */}
      {currentAlt !== null && (
        isLastQuestion ? (
          <button
            onClick={handleAdvance}
            disabled={submitting}
            className="fixed bottom-6 left-6 right-6 z-40 flex items-center justify-center gap-2 h-14 rounded-2xl bg-red-500 text-white font-bold text-base hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/30"
          >
            Finalizar
          </button>
        ) : (
          <button
            onClick={handleAdvance}
            disabled={submitting}
            title="Próxima Questão"
            aria-label="Próxima Questão"
            className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )
      )}

      {/* Modal de Imagem */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="tap-target absolute -top-10 right-0 flex items-center justify-center text-white bg-slate-100/60 rounded-full p-1.5 hover:bg-slate-100/80"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewImageUrl} alt="Imagem Ampliada" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
