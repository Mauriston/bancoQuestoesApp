import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, X, ZoomIn, Trophy, AlertCircle, ArrowLeft, CircleCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExamById, getExamQuestions, startExamAttempt, getAttemptAnswers,
  saveAttemptAnswer, getUserAssignments, isExamActive, createNotification, getAreas, getThemes
} from '../../services/firebaseService';
import { finishAndGradeAttempt } from '../../services/gradingService';
import { Exam, ExamQuestion, Area, Theme } from '../../types';

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
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
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

        getAreas().then(setAreas).catch(() => {});
        getThemes().then(setThemes).catch(() => {});

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

  const areaName = areas.find(a => a.id === currentQ.areaId)?.name;
  const themeName = themes.find(t => t.id === currentQ.themeId)?.name;

  return (
    <div className="max-w-3xl mx-auto pb-32">

      {/* Topo fixo: módulo/contador de questões à esquerda, chip da área/tema
          à direita, barra de progresso segmentada — um segmento por questão
          já respondida (substitui o antigo indicador em pizza). */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur pt-3 pb-2.5 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 truncate">
              {exam?.name || 'Simulado Ortopedia'}
            </p>
            <p className="text-sm font-bold text-[#050f41]">
              Questão {currentIndex + 1} <span className="text-slate-400 font-semibold">de {questions.length}</span>
            </p>
          </div>
          {(areaName || themeName) && (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold truncate max-w-[45%]">
              {themeName || areaName}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                idx <= currentIndex && (savedAlt[q.id] || (idx === currentIndex && currentAlt)) ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question Content Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl mt-4">

        {/* Enunciado */}
        <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
          {`${currentIndex + 1}. ${currentQ.statement}`}
        </p>

        {/* Image Preview se houver — centralizada na página; clique amplia em modal */}
        {currentQ.imageUrl && (
          <div className="mb-6 flex justify-center">
            <div className="relative group cursor-pointer max-w-md" onClick={() => setPreviewImageUrl(currentQ.imageUrl)}>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <img
                  src={currentQ.imageUrl}
                  alt="Imagem da questão"
                  className="rounded-xl max-h-72 w-auto object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="absolute right-3 bottom-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#050f41]/85 text-white text-[11px] font-semibold">
                <ZoomIn className="w-3.5 h-3.5" />
                ampliar
              </span>
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
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500 text-[#050f41] shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-[#050f41]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {letter}
                </div>
                <span className={`text-sm sm:text-base leading-relaxed flex-1 ${isSelected ? 'font-semibold' : 'font-normal'}`}>{text}</span>
                {isSelected && <CircleCheck className="w-[18px] h-[18px] text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>

      </div>

      {/* Barra de ação inferior fixa — substitui o antigo FAB. Habilita
          "Avançar"/"Finalizar" só depois de marcar uma alternativa; não é
          possível voltar a uma questão já respondida. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 hidden sm:block">
            <p className="text-[11px] font-semibold text-slate-400 truncate">
              {currentAlt ? `Alternativa ${currentAlt} marcada` : 'Selecione uma alternativa'}
            </p>
            <p className="text-[11px] text-slate-500">Não é possível voltar depois de avançar.</p>
          </div>
          <button
            onClick={handleAdvance}
            disabled={submitting || currentAlt === null}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm transition-colors"
          >
            {isLastQuestion ? 'Finalizar' : 'Avançar'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal de Imagem */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="tap-target absolute -top-10 right-0 flex items-center justify-center text-white bg-[#050f41]/60 rounded-full p-1.5 hover:bg-[#050f41]/80"
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
