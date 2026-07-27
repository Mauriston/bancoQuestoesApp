import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, X, ZoomIn, Send
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExamById, getExamQuestions, startExamAttempt, getAttemptAnswers,
  saveAttemptAnswer, getUserAssignments
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
  // Só guarda a resposta da questão atual — usuário não pode voltar para
  // revisar/alterar questões já respondidas, então não há por que manter um
  // mapa completo de respostas em memória durante a execução. Guardamos os
  // ids (não as respostas) das questões já respondidas apenas para contar
  // corretamente o progresso sem depender de reler o Firestore a cada clique.
  const [currentAlt, setCurrentAlt] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
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
        const answeredSet = new Set(savedAns.filter(a => a.selectedAlternative !== null).map(a => a.examQuestionId));
        setAnsweredIds(answeredSet);
        const firstUnanswered = examQuestions.findIndex(q => !answeredSet.has(q.id));
        setCurrentIndex(firstUnanswered === -1 ? examQuestions.length - 1 : firstUnanswered);

      } catch (err) {
        console.error("Erro ao iniciar prova:", err);
      } finally {
        setLoading(false);
      }
    }
    initExam();
  }, [assignmentId, currentUser]);

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = answeredIds.size;

  const handleSelectOption = (alt: "A" | "B" | "C" | "D") => {
    setCurrentAlt(prev => (prev === alt ? null : alt));
  };

  const handleAdvance = async () => {
    if (!currentQ || !attemptId || submitting) return;
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
      setAnsweredIds(prev => {
        const next = new Set(prev);
        if (currentAlt !== null) next.add(currentQ.id);
        else next.delete(currentQ.id);
        return next;
      });

      if (isLastQuestion) {
        setFinishModalOpen(true);
      } else {
        setCurrentIndex(prev => prev + 1);
        setCurrentAlt(null);
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
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

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
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Não é possível retornar a questões anteriores
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
        <div
          className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Content Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg">
            Questão #{currentIndex + 1}
          </span>
        </div>

        {/* Enunciado */}
        <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-line mb-6">
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
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs gap-1.5 font-semibold">
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

        {/* Avançar (sem opção de voltar) */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={handleAdvance}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20"
          >
            <span>{isLastQuestion ? 'Revisar e Finalizar' : 'Próxima Questão'}</span>
            {isLastQuestion ? <Send className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Modal de Imagem */}
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

      {/* Confirmação de Término */}
      {finishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Finalizar Prova?</h3>
                <p className="text-xs text-slate-400">Essa foi a última questão. Confirme o envio definitivo das suas respostas.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>✔ Respondidas: <strong className="text-teal-400">{answeredCount}</strong> de {questions.length}</p>
              <p>⏳ Sem resposta: <strong className="text-amber-400">{questions.length - answeredCount}</strong></p>
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
