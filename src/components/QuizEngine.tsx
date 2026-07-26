import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, ArrowRight, RotateCcw, Bookmark, Sparkles, Zap,
  Clock, ShieldAlert, BookOpen, FileText, Lightbulb, Play, AlertCircle, ChevronRight 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, AreaTema, QuizAttempt, QuestionAnswerLog, SavedQuestion } from '../types';
import { HIGH_YIELD_QUESTIONS } from '../data/prebakedQuestions';

interface QuizEngineProps {
  arvoreData: AreaTema[];
  initialArea?: string;
  initialTema?: string;
  onFinishQuiz: (attempt: QuizAttempt) => void;
  onSaveQuestion: (question: Question, notes?: string) => void;
  savedQuestions: SavedQuestion[];
}

export const QuizEngine: React.FC<QuizEngineProps> = ({
  arvoreData,
  initialArea,
  initialTema,
  onFinishQuiz,
  onSaveQuestion,
  savedQuestions
}) => {
  // Config state
  const [selectedArea, setSelectedArea] = useState<string>(initialArea || '');
  const [selectedTema, setSelectedTema] = useState<string>(initialTema || '');
  const [quizMode, setQuizMode] = useState<'estudo' | 'simulado'>('estudo');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [dificuldade, setDificuldade] = useState<string>('teot');

  // Active quiz state
  const [isQuizActive, setIsQuizActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [answersLog, setAnswersLog] = useState<QuestionAnswerLog[]>([]);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [userNoteText, setUserNoteText] = useState<string>('');
  const [isNoteInputOpen, setIsNoteInputOpen] = useState<boolean>(false);

  // Sync if initial props change
  useEffect(() => {
    if (initialArea) setSelectedArea(initialArea);
    if (initialTema) setSelectedTema(initialTema);
  }, [initialArea, initialTema]);

  // Timer effect during active quiz
  useEffect(() => {
    let interval: any = null;
    if (isQuizActive) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isQuizActive]);

  const availableTemas = React.useMemo(() => {
    const areaObj = arvoreData.find(a => a.Área === selectedArea);
    return areaObj ? areaObj.temas : [];
  }, [arvoreData, selectedArea]);

  // Start generating / preparing questions
  const handleStartQuiz = async (areaToUse?: string, temaToUse?: string) => {
    const targetArea = areaToUse || selectedArea || arvoreData[0]?.Área || 'Oncologia Ortopédica';
    const targetTema = temaToUse || selectedTema || (arvoreData.find(a => a.Área === targetArea)?.temas[0] || 'Geral');

    setIsLoading(true);
    try {
      // Call backend API
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: targetArea,
          tema: targetTema,
          count: questionCount,
          dificuldade
        })
      });

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        // Fallback to high yield matching questions
        const filtered = HIGH_YIELD_QUESTIONS.filter(q => q.area === targetArea);
        setQuestions(filtered.length > 0 ? filtered : HIGH_YIELD_QUESTIONS.slice(0, questionCount));
      }
    } catch (e) {
      console.warn('Network error when fetching questions, using prebaked high-yield database.', e);
      const filtered = HIGH_YIELD_QUESTIONS.filter(q => q.area === targetArea);
      setQuestions(filtered.length > 0 ? filtered : HIGH_YIELD_QUESTIONS.slice(0, questionCount));
    } finally {
      setIsLoading(false);
      setIsQuizActive(true);
      setCurrentIndex(0);
      setSelectedOption(null);
      setIsConfirmed(false);
      setAnswersLog([]);
      setTimerSeconds(0);
      setQuestionStartTime(Date.now());
    }
  };

  // Start Quick Express Quiz across random high-yield questions
  const handleStartExpressQuiz = () => {
    // Shuffle HIGH_YIELD_QUESTIONS
    const shuffled = [...HIGH_YIELD_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuestions(shuffled);
    setIsQuizActive(true);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsConfirmed(false);
    setAnswersLog([]);
    setTimerSeconds(0);
    setQuestionStartTime(Date.now());
  };

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isConfirmed && quizMode === 'estudo') return; // Cannot change answer after confirming in study mode
    setSelectedOption(idx);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || !currentQuestion) return;

    const isCorrect = selectedOption === currentQuestion.respostaCorreta;
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    const newLog: QuestionAnswerLog = {
      question: currentQuestion,
      selectedOption,
      isCorrect,
      timeSpentSeconds: timeSpent
    };

    if (quizMode === 'estudo') {
      setIsConfirmed(true);
      setAnswersLog(prev => [...prev, newLog]);
    } else {
      // In simulado mode, confirm moves directly to next question or finishes
      const updatedLog = [...answersLog, newLog];
      setAnswersLog(updatedLog);

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsConfirmed(false);
        setQuestionStartTime(Date.now());
      } else {
        finishQuizSession(updatedLog);
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsConfirmed(false);
      setIsNoteInputOpen(false);
      setUserNoteText('');
      setQuestionStartTime(Date.now());
    } else {
      finishQuizSession(answersLog);
    }
  };

  const finishQuizSession = (logs: QuestionAnswerLog[]) => {
    const totalCorrect = logs.filter(l => l.isCorrect).length;
    
    // Trigger confetti if accuracy >= 80%
    if (logs.length > 0 && (totalCorrect / logs.length) >= 0.8) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    const attempt: QuizAttempt = {
      id: `att-${Date.now()}`,
      date: new Date().toISOString(),
      area: selectedArea || 'Geral',
      tema: selectedTema || 'Geral',
      mode: quizMode,
      totalQuestions: logs.length,
      correctAnswers: totalCorrect,
      timeSpentSeconds: timerSeconds,
      answers: logs
    };

    setIsQuizActive(false);
    onFinishQuiz(attempt);
  };

  const isQuestionSaved = currentQuestion 
    ? savedQuestions.some(sq => sq.question.id === currentQuestion.id || sq.question.enunciado === currentQuestion.enunciado)
    : false;

  const handleSaveCurrentQuestion = () => {
    if (!currentQuestion) return;
    onSaveQuestion(currentQuestion, userNoteText);
    setIsNoteInputOpen(false);
  };

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Setup / Generator View
  if (!isQuizActive && !isLoading) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulador TEOT / SBOT com Inteligência Artificial</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-outfit">
              Pratique Questões Oficiais por Área & Tema Ortopédico
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-3 leading-relaxed">
              Monte simulados customizados de alta performance com a matriz de temas da SBOT. Desfrute de feedback cirúrgico imediato no <strong className="text-teal-400">Modo Estudo</strong> ou simule o ambiente de prova no <strong className="text-teal-400">Modo Simulado</strong>.
            </p>
          </div>

          {/* Quick Express Launcher */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Simulado Rápido TEOT (5 Questões)</h4>
                <p className="text-xs text-slate-400">Questões de altíssimo rendimento selecionadas das principais áreas.</p>
              </div>
            </div>

            <button
              onClick={handleStartExpressQuiz}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Treino Rápido</span>
            </button>
          </div>
        </div>

        {/* Custom Quiz Configuration Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-800">
            <BookOpen className="w-6 h-6 text-teal-400" />
            <div>
              <h2 className="text-xl font-bold text-white font-outfit">Configurar Simulado Personalizado</h2>
              <p className="text-xs text-slate-400">Filtre a especialidade e o tema que você deseja reforçar.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Area Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                1. Grande Área da Ortopedia
              </label>
              <select
                value={selectedArea}
                onChange={(e) => {
                  setSelectedArea(e.target.value);
                  setSelectedTema(''); // Reset tema when area changes
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
              >
                <option value="">-- Selecione uma Área (ou todas) --</option>
                {arvoreData.map((a) => (
                  <option key={a.Área} value={a.Área}>
                    {a.Área} ({a.temas.length} temas)
                  </option>
                ))}
              </select>
            </div>

            {/* Tema Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                2. Tema Específico
              </label>
              <select
                value={selectedTema}
                onChange={(e) => setSelectedTema(e.target.value)}
                disabled={!selectedArea}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-50 transition"
              >
                <option value="">
                  {selectedArea ? '-- Selecione um Tema --' : 'Selecione uma área primeiro'}
                </option>
                {availableTemas.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Quiz Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                3. Modo de Aplicação
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQuizMode('estudo')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    quizMode === 'estudo'
                      ? 'bg-teal-500/15 border-teal-500/60 text-teal-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>Modo Estudo</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Comentários e gabarito imediato após responder.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setQuizMode('simulado')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    quizMode === 'simulado'
                      ? 'bg-teal-500/15 border-teal-500/60 text-teal-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span>Modo Simulado</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Gabarito revelado somente ao final da prova.</p>
                </button>
              </div>
            </div>

            {/* Questions Count & Difficulty */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                4. Quantidade & Nível
              </label>
              <div className="flex items-center space-x-3">
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500 flex-1"
                >
                  <option value={3}>3 Questões</option>
                  <option value={5}>5 Questões</option>
                  <option value={10}>10 Questões</option>
                  <option value={15}>15 Questões</option>
                </select>

                <select
                  value={dificuldade}
                  onChange={(e) => setDificuldade(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-teal-500 flex-1"
                >
                  <option value="teot">Nível Prova TEOT</option>
                  <option value="medio">Nível Médio / R1-R2</option>
                  <option value="dificil">Nível Desafio R3 / Preceptoria</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => handleStartQuiz()}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-base transition duration-200 shadow-xl shadow-teal-500/20 flex items-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 fill-current" />
              <span>Gerar Questões & Iniciar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin mx-auto mb-6" />
        <h3 className="text-xl font-bold text-white font-outfit">
          Gerando Questões TEOT...
        </h3>
        <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
          Formatando casos clínicos detalhados e gabaritos comentados com base na literatura médica da SBOT.
        </p>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Quiz Progress Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/40">
            Questão {currentIndex + 1} de {questions.length}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            • {currentQuestion?.area}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 max-w-xs mx-4 hidden md:block">
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-300" 
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Timer & Quiz Mode indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 font-mono">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          <button
            onClick={() => {
              if (confirm('Deseja realmente encerrar este simulado?')) {
                finishQuizSession(answersLog);
              }
            }}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg transition"
          >
            Encerrar
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      {currentQuestion && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                {currentQuestion.area}
              </span>
              <span className="text-xs font-medium text-teal-300 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20">
                {currentQuestion.tema}
              </span>
            </div>

            <button
              onClick={handleSaveCurrentQuestion}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                isQuestionSaved 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isQuestionSaved ? 'fill-current text-amber-400' : ''}`} />
              <span>{isQuestionSaved ? 'Salva no Caderno' : 'Salvar Questão'}</span>
            </button>
          </div>

          {/* Enunciado */}
          <div className="mb-8">
            <h2 className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed font-sans">
              {currentQuestion.enunciado}
            </h2>
          </div>

          {/* Alternatives List */}
          <div className="space-y-3 mb-8">
            {(currentQuestion.opcoes || []).map((opcaoText, idx) => {
              const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
              const isSelected = selectedOption === idx;
              const isCorrectOption = idx === currentQuestion.respostaCorreta;

              let styleClasses = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850';

              if (quizMode === 'estudo' && isConfirmed) {
                if (isCorrectOption) {
                  styleClasses = 'bg-emerald-500/15 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-500/10';
                } else if (isSelected && !isCorrectOption) {
                  styleClasses = 'bg-rose-500/15 border-rose-500/80 text-rose-200';
                } else {
                  styleClasses = 'bg-slate-950/50 border-slate-800/60 text-slate-500 opacity-60';
                }
              } else if (isSelected) {
                styleClasses = 'bg-teal-500/20 border-teal-500 text-teal-200 shadow-lg shadow-teal-500/10';
              }

              return (
                <button
                  key={idx}
                  disabled={quizMode === 'estudo' && isConfirmed}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start space-x-3.5 cursor-pointer ${styleClasses}`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition ${
                    quizMode === 'estudo' && isConfirmed && isCorrectOption
                      ? 'bg-emerald-500 text-slate-950'
                      : quizMode === 'estudo' && isConfirmed && isSelected && !isCorrectOption
                      ? 'bg-rose-500 text-white'
                      : isSelected
                      ? 'bg-teal-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {optionLetter}
                  </div>

                  <div className="flex-1 text-sm pt-0.5 leading-normal font-sans">
                    {opcaoText}
                  </div>

                  {quizMode === 'estudo' && isConfirmed && isCorrectOption && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {quizMode === 'estudo' && isConfirmed && isSelected && !isCorrectOption && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Bar (Confirm / Next) */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-500">
              {quizMode === 'estudo' ? 'Modo Estudo (Feedback Imediato)' : 'Modo Simulado (Gabarito ao Final)'}
            </div>

            <div>
              {(!isConfirmed && quizMode === 'estudo') || quizMode === 'simulado' ? (
                <button
                  disabled={selectedOption === null}
                  onClick={handleConfirmAnswer}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold text-sm transition shadow-lg shadow-teal-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  <span>{quizMode === 'simulado' ? 'Avançar Questão' : 'Confirmar Resposta'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  <span>{currentIndex + 1 < questions.length ? 'Próxima Questão' : 'Ver Resultado'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Study Mode Commentary Card */}
          {quizMode === 'estudo' && isConfirmed && (
            <div className="mt-8 p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base font-outfit">Justificativa Comentada SBOT</h3>
                </div>
                <span className="text-xs text-slate-400 italic">
                  Ref: {currentQuestion.referencia || 'Campbell / Rockwood'}
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {currentQuestion.explicacao}
              </p>

              {currentQuestion.pontosChave && currentQuestion.pontosChave.length > 0 && (
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
                    📌 Pontos-Chave para a Prova TEOT:
                  </span>
                  <ul className="space-y-1">
                    {currentQuestion.pontosChave.map((ponto, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start space-x-2">
                        <span className="text-teal-400 font-bold">•</span>
                        <span>{ponto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
