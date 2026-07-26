import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, ArrowLeft, ArrowRight, Bookmark, CheckCircle2, AlertTriangle, 
  X, ZoomIn, Send, FileText, Check 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getExamById, getExamQuestions, startExamAttempt, getAttemptAnswers, 
  saveAttemptAnswer, getUserAssignments 
} from '../../services/firebaseService';
import { finishAndGradeAttempt } from '../../services/gradingService';
import { Exam, ExamQuestion, AttemptAnswer } from '../../types';
import { formatTimeSeconds } from '../../utils/helpers';

export const TakeExamPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, { alt: "A"|"B"|"C"|"D"|null; flagged: boolean }>>({});
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  
  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Image lightbox modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null | undefined>(null);

  useEffect(() => {
    async function initExam() {
      if (!assignmentId || !currentUser) return;
      try {
        setLoading(true);

        const allAssignments = await getUserAssignments(currentUser.id);
        const asgn = allAssignments.find(a => a.id === assignmentId);
        if (!asgn) throw new Error("Atribuição de prova não encontrada");

        const examData = await getExamById(asgn.examId);
        if (!examData) throw new Error("Dados da prova não encontrados");
        setExam(examData);

        // Start or resume attempt
        const { attemptId: attId, examQuestions } = await startExamAttempt(
          assignmentId, 
          currentUser.id, 
          asgn.examId
        );
        setAttemptId(attId);
        setQuestions(examQuestions);

        // Load existing saved answers
        const savedAns = await getAttemptAnswers(attId);
        const ansMap: Record<string, { alt: "A"|"B"|"C"|"D"|null; flagged: boolean }> = {};
        savedAns.forEach(a => {
          ansMap[a.examQuestionId] = {
            alt: a.selectedAlternative,
            flagged: !!a.flaggedForReview
          };
        });
        setAnswers(ansMap);

        // Timer setup
        if (examData.durationMinutes && examData.durationMinutes > 0) {
          setRemainingSeconds(examData.durationMinutes * 60);
        }

      } catch (err) {
        console.error("Erro ao iniciar prova:", err);
      } finally {
        setLoading(false);
      }
    }

    initExam();
  }, [assignmentId, currentUser]);

  // Countdown timer effect
  useEffect(() => {
    if (remainingSeconds === null || submitting) return;

    if (remainingSeconds <= 0) {
      handleFinishExam(); // Auto finish on time expiration
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, submitting]);

  const currentQ = questions[currentIndex];
  const currentAns = currentQ ? answers[currentQ.id] : null;

  const handleSelectOption = async (alt: "A" | "B" | "C" | "D") => {
    if (!currentQ || !attemptId) return;

    const newAlt = currentAns?.alt === alt ? null : alt; // toggle option
    const newFlag = currentAns?.flagged || false;

    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: { alt: newAlt, flagged: newFlag }
    }));

    // Auto-save to Firestore in background
    try {
      await saveAttemptAnswer(
        attemptId,
        currentQ.id,
        currentQ.originalQuestionId,
        newAlt,
        currentQ.areaId,
        currentQ.themeId,
        newFlag
      );
    } catch (e) {
      console.error("Erro ao salvar resposta no banco:", e);
    }
  };

  const handleToggleFlag = async () => {
    if (!currentQ || !attemptId) return;

    const newFlag = !currentAns?.flagged;
    const currentSelected = currentAns?.alt || null;

    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: { alt: currentSelected, flagged: newFlag }
    }));

    try {
      await saveAttemptAnswer(
        attemptId,
        currentQ.id,
        currentQ.originalQuestionId,
        currentSelected,
        currentQ.areaId,
        currentQ.themeId,
        newFlag
      );
    } catch (e) {
      console.error("Erro ao salvar flag:", e);
    }
  };

  const handleFinishExam = async () => {
    if (submitting || !attemptId) return;

    setSubmitting(true);
    setFinishModalOpen(false);

    try {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await finishAndGradeAttempt(attemptId, elapsed);
      navigate(`/app/attempts/${attemptId}/result`);
    } catch (err) {
      console.error("Erro ao finalizar prova:", err);
      alert("Ocorreu um erro ao enviar sua prova. Tente novamente.");
      setSubmitting(false);
    }
  };

  if (loading || !currentQ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Iniciando ambiente seguro da prova...</p>
      </div>
    );
  }

  const answeredCount = Object.values(answers).filter(a => a.alt !== null).length;
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header Bar */}
      <div className="sticky top-16 z-30 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white leading-tight">
            {exam?.name || 'Simulado Ortopedia'}
          </h2>
          <p className="text-xs text-slate-400">
            Questão {currentIndex + 1} de {questions.length} ({answeredCount} respondidas)
          </p>
        </div>

        {/* Timer & Finish Controls */}
        <div className="flex items-center gap-4">
          {remainingSeconds !== null && (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono ${
              remainingSeconds < 300 
                ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' 
                : 'bg-slate-950 border-slate-800 text-teal-400'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimeSeconds(remainingSeconds)}</span>
            </div>
          )}

          <button
            onClick={() => setFinishModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-teal-500/20 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finalizar Prova</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
        <div 
          className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Exam Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Question Content Box */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            
            {/* Question Top Tags */}
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg">
                Questão #{currentIndex + 1}
              </span>

              <button
                onClick={handleToggleFlag}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  currentAns?.flagged 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${currentAns?.flagged ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{currentAns?.flagged ? 'Marcar para Revisar' : 'Marcar para Revisar'}</span>
              </button>
            </div>

            {/* Enunciado */}
            <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
              {currentQ.statement}
            </p>

            {/* Image Preview if available */}
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
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
                    <ZoomIn className="w-4 h-4" />
                    <span>Clique para ampliar</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alternatives A, B, C, D */}
            <div className="space-y-3">
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const text = currentQ.alternatives[letter];
                if (!text) return null;
                const isSelected = currentAns?.alt === letter;

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelectOption(letter)}
                    className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500/60 text-white shadow-md shadow-teal-500/10'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {letter}
                    </div>
                    <span className="text-xs sm:text-sm leading-relaxed font-normal flex-1">{text}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation Bottom Controls */}
            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <button
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-teal-600/20"
              >
                <span>Próxima</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Question Navigator Drawer Sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">
              Navegação das Questões
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isCurrent = idx === currentIndex;
                const isAnswered = ans && ans.alt !== null;
                const isFlagged = ans && ans.flagged;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg font-bold text-xs flex items-center justify-center relative transition-all ${
                      isCurrent
                        ? 'ring-2 ring-teal-400 bg-teal-500 text-slate-950'
                        : isAnswered
                        ? 'bg-slate-800 text-teal-300 border border-teal-500/30'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-teal-500/20 border border-teal-500/40" />
                <span>Respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span>Marcada p/ Revisão</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-950 border border-slate-800" />
                <span>Pendente</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Image Lightbox Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewImageUrl} alt="Imagem Ampliada" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}

      {/* Confirm Finish Modal */}
      {finishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Finalizar Prova?</h3>
                <p className="text-xs text-slate-400">Confirme o envio definitivo das suas respostas.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>• Respondidas: <strong className="text-teal-400">{answeredCount}</strong> de {questions.length}</p>
              <p>• Pendentes: <strong className="text-amber-400">{questions.length - answeredCount}</strong></p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setFinishModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
              >
                Voltar à Prova
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
