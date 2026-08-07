import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, FileCheck, Search, AlertCircle, Sparkles, Eye, Image as ImageIcon, XCircle, CheckCircle2, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getQuestions, getAreas, getThemes, getActiveUsers, createAndPublishExam, getQuestionAnswersByIds,
  getExamById, getExamQuestions, getAttemptsForExam, isExamActive, updateExamContent
} from '../../services/firebaseService';
import { Question, Area, Theme, AppUser, QuestionAnswer } from '../../types';
import { SOURCE_EXAM_OPTIONS } from '../../constants';
import { QuestionPreviewModal } from '../../components/QuestionPreviewModal';

export const CreateExamPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // Presença de :examId na rota (/admin/exams/:examId/edit) decide o modo:
  // editar uma prova existente (inativa e sem tentativas — ver o gate logo
  // abaixo) reaproveitando o mesmo assistente, em vez de criar uma nova.
  const { examId } = useParams<{ examId: string }>();
  const isEditMode = !!examId;
  const [step, setStep] = useState(1);
  const [gateError, setGateError] = useState('');

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAlternatives, setShuffleAlternatives] = useState(false);
  const [showResultAfterFinish, setShowResultAfterFinish] = useState(true);
  const [showCommentsAfterFinish, setShowCommentsAfterFinish] = useState(true);
  const [allowReviewAfterFinish, setAllowReviewAfterFinish] = useState(true);

  // Step 2: Question Selection
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [areaFilter, setAreaFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [subAreaFilter, setSubAreaFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Fonte da Questão: menu suspenso com caixas de seleção, mesma lista fixa
  // usada em QuestionsPage (ver SOURCE_EXAM_OPTIONS).
  const [selectedSourceExams, setSelectedSourceExams] = useState<string[]>([]);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [answersById, setAnswersById] = useState<Record<string, QuestionAnswer>>({});

  // Step 3: User Assignment
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [assignMode, setAssignMode] = useState<'all' | 'custom'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Submitting
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadResources() {
      try {
        const [qList, arList, thList, uList] = await Promise.all([
          getQuestions(),
          getAreas(),
          getThemes(),
          getActiveUsers()
        ]);
        setAllQuestions(qList);
        setAreas(arList);
        setThemes(thList);
        // O admin não realiza provas, então não pode ser destinatário.
        setActiveUsers(uList.filter(u => u.role !== 'admin'));
        getQuestionAnswersByIds(qList.map(q => q.id))
          .then(setAnswersById)
          .catch(err => console.error("Erro ao carregar gabaritos:", err));

        if (examId) {
          // Mesmo gate de updateExamContent() no firebaseService, checado
          // aqui antes de deixar o admin mexer no formulário — evita abrir o
          // assistente para uma prova que na verdade não pode mais ser
          // editada (ativada ou já respondida por alguém entre um clique e
          // outro).
          const [exam, attempts, examQuestions] = await Promise.all([
            getExamById(examId),
            getAttemptsForExam(examId),
            getExamQuestions(examId)
          ]);

          if (!exam) {
            setGateError("Prova não encontrada.");
          } else if (isExamActive(exam)) {
            setGateError('Esta prova está ativa e não pode ser editada. Desative-a primeiro em "Provas e Simulados".');
          } else if (attempts.length > 0) {
            setGateError("Esta prova já tem tentativas registradas e não pode mais ser editada.");
          } else {
            setName(exam.name);
            setShuffleQuestions(!!exam.shuffleQuestions);
            setShuffleAlternatives(!!exam.shuffleAlternatives);
            setShowResultAfterFinish(exam.showResultAfterFinish !== false);
            setShowCommentsAfterFinish(exam.showCommentsAfterFinish !== false);
            setAllowReviewAfterFinish(exam.allowReviewAfterFinish !== false);

            // Questões atualmente na prova, casadas de volta com o banco
            // (para permitir marcar/desmarcar normalmente na Etapa 2). Uma
            // questão congelada cujo original tenha sido excluído do banco
            // simplesmente não aparece pré-selecionada.
            const originalIds = new Set(examQuestions.map(eq => eq.originalQuestionId));
            setSelectedQuestions(qList.filter(q => originalIds.has(q.id)));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        if (examId) setGateError("Não foi possível carregar os dados desta prova.");
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadResources();
  }, [examId]);

  const themesForAreaFilter = areaFilter ? themes.filter(t => t.areaId === areaFilter) : themes;

  // Subáreas distintas presentes entre os temas da área selecionada — vazio
  // (e o seletor fica desabilitado) se nenhuma área foi escolhida ou se a
  // área não tem subagrupamento (ex.: Anatomia, Ciência Básica).
  const subAreasForAreaFilter = areaFilter
    ? Array.from(new Set(themesForAreaFilter.map(t => t.subArea).filter((s): s is string => !!s)))
    : [];

  // Mapa themeId -> subArea, para filtrar questões (que só carregam
  // themeId) sem precisar de outra ida ao Firestore.
  const themeSubAreaById = new Map(themes.map(t => [t.id, t.subArea]));

  const filteredQuestions = allQuestions.filter(q => {
    const matchesArea = !areaFilter || q.areaId === areaFilter;
    const matchesTheme = !themeFilter || q.themeId === themeFilter;
    const matchesSubArea = !subAreaFilter || themeSubAreaById.get(q.themeId) === subAreaFilter;
    const matchesSearch = !searchQuery || q.statement.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = selectedSourceExams.length === 0 || selectedSourceExams.includes(q.sourceExam);
    return matchesArea && matchesTheme && matchesSubArea && matchesSearch && matchesSource;
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSourceExam = (value: string) => {
    setSelectedSourceExams(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleToggleQuestionSelect = (q: Question) => {
    if (selectedQuestions.some(sq => sq.id === q.id)) {
      setSelectedQuestions(prev => prev.filter(sq => sq.id !== q.id));
    } else {
      setSelectedQuestions(prev => [...prev, q]);
    }
  };

  const handleSelectAllFiltered = () => {
    const newItems = filteredQuestions.filter(fq => !selectedQuestions.some(sq => sq.id === fq.id));
    setSelectedQuestions(prev => [...prev, ...newItems]);
  };

  const handlePublish = async () => {
    if (!name || selectedQuestions.length === 0 || !currentUser) {
      setErrorMsg("Preencha todos os campos e selecione pelo menos uma questão.");
      return;
    }
    setPublishing(true);
    setErrorMsg('');

    try {
      const assignedIds = assignMode === 'all' ? ['all'] : selectedUserIds;
      await createAndPublishExam({
        examData: {
          name,
          status: 'published',
          questionCount: selectedQuestions.length,
          shuffleQuestions,
          shuffleAlternatives,
          showResultAfterFinish,
          showCommentsAfterFinish,
          allowReviewAfterFinish,
          createdBy: currentUser.id
        },
        questions: selectedQuestions,
        assignedUserIds: assignedIds,
        adminId: currentUser.id
      });
      navigate('/admin/exams');
    } catch (err: any) {
      setErrorMsg("Erro ao publicar prova: " + err.message);
      setPublishing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!examId || !name || selectedQuestions.length === 0) {
      setErrorMsg("Preencha todos os campos e selecione pelo menos uma questão.");
      return;
    }
    setPublishing(true);
    setErrorMsg('');

    try {
      await updateExamContent({
        examId,
        examData: {
          name,
          shuffleQuestions,
          shuffleAlternatives,
          showResultAfterFinish,
          showCommentsAfterFinish,
          allowReviewAfterFinish
        },
        questions: selectedQuestions
      });
      navigate('/admin/exams');
    } catch (err: any) {
      setErrorMsg("Erro ao salvar alterações: " + err.message);
      setPublishing(false);
    }
  };

  if (isEditMode && loadingQuestions) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando dados da prova...</p>
      </div>
    );
  }

  if (gateError) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center py-20 text-slate-400 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-200 font-semibold">{gateError}</p>
        <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Lista de Provas</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Lista de Provas</span>
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          {isEditMode ? 'Editar Prova' : 'Assistente de Criação de Prova'}
        </h1>
      </div>

      {/* Step Indicator Header — sem a etapa de atribuição de usuários no
          modo de edição, já que os destinatários já existem e não são
          mexidos aqui. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-800 pb-4 text-xs font-semibold">
        <span className={step >= 1 ? 'text-cyan-400' : 'text-slate-500'}>1. Dados Básicos</span>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
        <span className={step >= 2 ? 'text-cyan-400' : 'text-slate-500'}>2. Seleção de Questões ({selectedQuestions.length})</span>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
        {!isEditMode && (
          <>
            <span className={step >= 3 ? 'text-cyan-400' : 'text-slate-500'}>3. Atribuição de Usuários</span>
            <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
          </>
        )}
        <span className={step >= 4 ? 'text-cyan-400' : 'text-slate-500'}>{isEditMode ? '3. Revisão e Salvamento' : '4. Revisão e Publicação'}</span>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Basic Info */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[#050f41] mb-2">Etapa 1: Dados e Configurações da Prova</h2>
          
          <div>
            <label className="block text-slate-300 font-medium mb-1">Nome / Título da Prova *</label>
            <input
              type="text"
              required
              placeholder="Ex: Simulado TEOT 2026 - Módulo Ortopedia Infantil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
            />
          </div>
          
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
              />
              <span>Embaralhar ordem das questões para cada candidato</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showResultAfterFinish}
                onChange={(e) => setShowResultAfterFinish(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
              />
              <span>Exibir nota e resultado imediatamente após finalizar</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showCommentsAfterFinish}
                onChange={(e) => setShowCommentsAfterFinish(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
              />
              <span>Exibir comentários e gabarito na revisão pós-prova</span>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={!name}
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-5 rounded-xl disabled:opacity-40"
            >
              <span>Avançar para Seleção de Questões</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Question Selection */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#050f41]">Etapa 2: Selecionar Questões do Banco</h2>
              <p className="text-slate-400">Questões selecionadas: <strong className="text-cyan-400">{selectedQuestions.length}</strong></p>
            </div>
            <button
              onClick={handleSelectAllFiltered}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Selecionar Todas as Filtradas
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Filtrar enunciado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
            />
            <select
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setThemeFilter('');
                setSubAreaFilter('');
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300"
            >
              <option value="">Todas as Áreas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select
              value={subAreaFilter}
              onChange={(e) => setSubAreaFilter(e.target.value)}
              disabled={!areaFilter || subAreasForAreaFilter.length === 0}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 disabled:opacity-50"
            >
              <option value="">
                {!areaFilter ? 'Selecione uma área' : subAreasForAreaFilter.length === 0 ? 'Sem subáreas' : 'Todas as Subáreas'}
              </option>
              {subAreasForAreaFilter.map(sa => <option key={sa} value={sa}>{sa}</option>)}
            </select>
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              disabled={!areaFilter}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 disabled:opacity-50"
            >
              <option value="">{areaFilter ? 'Todos os Temas' : 'Selecione uma área'}</option>
              {themesForAreaFilter.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="relative" ref={sourceDropdownRef}>
              <button
                type="button"
                onClick={() => setSourceDropdownOpen(prev => !prev)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {selectedSourceExams.length === 0
                    ? 'Todas as Fontes'
                    : `${selectedSourceExams.length} fonte${selectedSourceExams.length > 1 ? 's' : ''} selecionada${selectedSourceExams.length > 1 ? 's' : ''}`}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${sourceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {sourceDropdownOpen && (
                <div className="absolute z-20 mt-1.5 w-full min-w-[14rem] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 max-h-64 overflow-y-auto">
                  {selectedSourceExams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSourceExams([])}
                      className="w-full text-left text-[10px] font-semibold uppercase text-cyan-400 hover:text-cyan-300 px-2 py-1.5"
                    >
                      Limpar seleção
                    </button>
                  )}
                  {SOURCE_EXAM_OPTIONS.map(opt => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceExams.includes(opt)}
                        onChange={() => toggleSourceExam(opt)}
                        className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(searchQuery || areaFilter || themeFilter || subAreaFilter || selectedSourceExams.length > 0) && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setAreaFilter('');
                  setThemeFilter('');
                  setSubAreaFilter('');
                  setSelectedSourceExams([]);
                }}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-[#050f41] text-[11px] font-semibold"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          )}

          <div className="max-h-[28rem] lg:max-h-[36rem] overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-3 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950">
            {filteredQuestions.map(q => {
              const isSelected = selectedQuestions.some(sq => sq.id === q.id);
              const answer = answersById[q.id];
              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleQuestionSelect(q)}
                  className={`p-3 lg:p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-[#050f41] shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="Miniatura da imagem da questão"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="font-semibold text-sm leading-relaxed line-clamp-2">{q.statement}</p>
                    {answer ? (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex items-baseline gap-1 min-w-0">
                          <strong className="font-bold shrink-0">{answer.correctAlternative})</strong>
                          <span className="truncate">{q.alternatives[answer.correctAlternative]}</span>
                        </span>
                      </p>
                    ) : (
                      q.imageUrl && <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewingQuestion(q); }}
                    title="Visualizar questão completa"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#050f41] hover:bg-slate-700 shrink-0"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">
              Voltar
            </button>
            <button
              disabled={selectedQuestions.length === 0}
              onClick={() => setStep(isEditMode ? 4 : 3)}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-5 rounded-xl disabled:opacity-40"
            >
              <span>{isEditMode ? 'Avançar para Revisão' : 'Avançar para Atribuição de Usuários'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: User Assignment — não existe no modo de edição */}
      {step === 3 && !isEditMode && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[#050f41] mb-2">Etapa 3: Atribuir a Prova aos Candidatos</h2>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-800 bg-slate-950">
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === 'all'}
                onChange={() => setAssignMode('all')}
                className="text-cyan-500"
              />
              <div>
                <strong className="text-[#050f41] block">Atribuir a TODOS os usuários ativos ({activeUsers.length})</strong>
                <span className="text-[10px] text-slate-400">Todos os residentes ativos receberão o simulado em seu painel.</span>
              </div>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-800 bg-slate-950">
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === 'custom'}
                onChange={() => setAssignMode('custom')}
                className="text-cyan-500"
              />
              <div>
                <strong className="text-[#050f41] block">Selecionar Usuários Específicos</strong>
                <span className="text-[10px] text-slate-400">Escolha quais residentes participarão.</span>
              </div>
            </label>
          </div>

          {assignMode === 'custom' && (
            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-3 bg-slate-950">
              {activeUsers.map(u => {
                const isChecked = selectedUserIds.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-900 rounded-lg cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      className="shrink-0"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds(prev => [...prev, u.id]);
                        else setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                      }}
                    />
                    <span className="text-slate-200 truncate">{u.name} ({u.email})</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">
              Voltar
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-5 rounded-xl"
            >
              <span>Avançar para Revisão Final</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Publish (ou Revisão e Salvamento, no modo de edição) */}
      {step === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[#050f41] border-b border-slate-800 pb-3">
            {isEditMode ? 'Etapa 3: Resumo e Confirmação das Alterações' : 'Etapa 4: Resumo e Confirmação de Publicação'}
          </h2>

          <div className="space-y-2 text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p>• Nome da Prova: <strong className="text-[#050f41]">{name}</strong></p>
            <p>• Total de Questões: <strong className="text-teal-400">{selectedQuestions.length}</strong></p>
            {!isEditMode && (
              <p>• Destinatários: <strong className="text-cyan-400">{assignMode === 'all' ? `Todos os ${activeUsers.length} usuários ativos` : `${selectedUserIds.length} usuários`}</strong></p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            {isEditMode
              ? 'A prova continua inativa após salvar. Ative-a novamente em "Provas e Simulados" quando estiver pronta.'
              : 'A prova é criada inativa. Os destinatários só vão vê-la e poder iniciá-la depois que você ativá-la em "Provas e Simulados".'}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(isEditMode ? 2 : 3)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">
              Voltar
            </button>
            <button
              onClick={isEditMode ? handleSaveEdit : handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {publishing
                  ? (isEditMode ? 'Salvando...' : 'Publicando...')
                  : (isEditMode ? 'Salvar Alterações' : 'Publicar Prova Agora')}
              </span>
            </button>
          </div>
        </div>
      )}

      {viewingQuestion && (
        <QuestionPreviewModal question={viewingQuestion} onClose={() => setViewingQuestion(null)} />
      )}
    </div>
  );
};
