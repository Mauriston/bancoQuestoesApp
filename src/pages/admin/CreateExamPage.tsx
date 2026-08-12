import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronLeft, FileCheck, Search, AlertCircle, Sparkles, Eye, Image as ImageIcon, XCircle, CheckCircle2, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getQuestions, getAreas, getThemes, getActiveUsers, createAndPublishExam, getQuestionAnswersByIds,
  getExamById, getExamQuestions, getAttemptsForExam, isExamActive, updateExamContent
} from '../../services/firebaseService';
import { Question, Area, Theme, AppUser, QuestionAnswer } from '../../types';
import { SOURCE_EXAM_GROUPS, SourceExamGroup, getSourceExamOptionsForGroup } from '../../constants';
import { QuestionPreviewModal } from '../../components/QuestionPreviewModal';
import { CheckboxMultiSelect } from '../../components/CheckboxMultiSelect';
import { Switch } from '../../components/Switch';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';

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
  const [themeFilterIds, setThemeFilterIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Switch para restringir a lista às questões já marcadas para a prova.
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  // Fonte da Questão: menu suspenso com caixas de seleção, mesma lista fixa
  // usada em QuestionsPage (ver SOURCE_EXAM_OPTIONS).
  const [selectedSourceExams, setSelectedSourceExams] = useState<string[]>([]);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  // Filtro rápido acima do dropdown de fontes (Todas/TEOT/TARO/Banco
  // Próprio) — restringe as opções exibidas no dropdown e, no caso de Banco
  // Próprio, força a seleção única e trava o dropdown em modo somente
  // leitura (ver handleSourceGroupChange).
  const [sourceExamGroup, setSourceExamGroup] = useState<SourceExamGroup>('TODAS');
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

  const filteredQuestions = allQuestions.filter(q => {
    const matchesArea = !areaFilter || q.areaId === areaFilter;
    const matchesTheme = themeFilterIds.length === 0 || themeFilterIds.includes(q.themeId);
    const matchesSearch = !searchQuery || q.statement.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = selectedSourceExams.length === 0 || selectedSourceExams.includes(q.sourceExam);
    const matchesSelected = !showOnlySelected || selectedQuestions.some(sq => sq.id === q.id);
    return matchesArea && matchesTheme && matchesSearch && matchesSource && matchesSelected;
  });

  // Contagem de questões selecionadas por tema, para a tabela abaixo do
  // quadro de filtros (ver THEME_TABLE_PAGE_SIZE / themeTablePage).
  const selectedThemeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of selectedQuestions) {
      counts[q.themeId] = (counts[q.themeId] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([themeId, count]) => ({ themeId, name: themes.find(t => t.id === themeId)?.name || themeId, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedQuestions, themes]);

  const THEME_TABLE_PAGE_SIZE = 5;
  const [themeTablePage, setThemeTablePage] = useState(0);
  const themeTablePageCount = Math.max(1, Math.ceil(selectedThemeCounts.length / THEME_TABLE_PAGE_SIZE));
  const pagedThemeCounts = selectedThemeCounts.slice(
    themeTablePage * THEME_TABLE_PAGE_SIZE,
    themeTablePage * THEME_TABLE_PAGE_SIZE + THEME_TABLE_PAGE_SIZE
  );

  useEffect(() => {
    if (themeTablePage > themeTablePageCount - 1) setThemeTablePage(0);
  }, [themeTablePageCount, themeTablePage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobile: some ao rolar para baixo, reaparece ao rolar para cima (não tem
  // efeito no desktop, onde a barra vira sidebar fixa — ver lg:translate-y-0
  // sempre aplicado abaixo).
  const filterBarHidden = useHideOnScroll();

  // Faz a lista de questões (coluna à direita) crescer até a mesma altura
  // do quadro lateral (filtros + tabela de temas) no desktop, em vez de usar
  // um max-height fixo que sobrava espaço em branco abaixo do card sempre
  // que o quadro lateral ficava mais alto (ex.: tabela de temas paginada).
  const sidebarColRef = useRef<HTMLDivElement>(null);
  const [sidebarColHeight, setSidebarColHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = sidebarColRef.current;
    if (!el) return;
    const updateHeight = () => setSidebarColHeight(window.innerWidth >= 1024 ? el.offsetHeight : null);
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);
    window.addEventListener('resize', updateHeight);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [step]);

  const toggleSourceExam = (value: string) => {
    setSelectedSourceExams(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleSourceGroupChange = (group: Exclude<SourceExamGroup, 'TODAS'>) => {
    if (group === sourceExamGroup) {
      // Clicar de novo no grupo já ativo desmarca o filtro rápido — volta a
      // exibir todas as fontes no dropdown, sem nenhuma pré-selecionada.
      setSourceExamGroup('TODAS');
      setSelectedSourceExams([]);
      return;
    }
    setSourceExamGroup(group);
    if (group === 'BANCO_PROPRIO') {
      setSelectedSourceExams(getSourceExamOptionsForGroup(group));
      setSourceDropdownOpen(false);
    } else {
      // TEOT/TARO: marca todas as caixas do grupo de saída, mas o dropdown
      // continua editável — o admin pode desmarcar provas/anos específicos.
      setSelectedSourceExams(getSourceExamOptionsForGroup(group));
    }
  };

  const handleToggleQuestionSelect = (q: Question) => {
    if (selectedQuestions.some(sq => sq.id === q.id)) {
      setSelectedQuestions(prev => prev.filter(sq => sq.id !== q.id));
    } else {
      setSelectedQuestions(prev => [...prev, q]);
    }
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

      {/* Título + indicador de etapas na mesma linha, para economizar
          espaço vertical (o indicador tinha uma linha inteira só para si). */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2 shrink-0">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          {isEditMode ? 'Editar Prova' : 'Assistente de Criação de Prova'}
        </h1>

        {/* Sem a etapa de atribuição de usuários no modo de edição, já que
            os destinatários já existem e não são mexidos aqui. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-semibold">
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
          {/* Barra de filtros: sidebar fixa ao lado da lista no desktop
              (lg+); no mobile continua acima da lista, some ao rolar para
              baixo e reaparece ao rolar para cima (useHideOnScroll).
              Sem overflow-y-auto/max-h aqui: o conteúdo do card é curto e
              nunca precisa rolar por conta própria, e um container com
              overflow corta (clipa) os menus suspensos de Tema/Fonte, que
              são absolutamente posicionados dentro dele. */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
            <div
              ref={sidebarColRef}
              className={`lg:w-72 xl:w-80 shrink-0 sticky top-16 lg:top-20 z-20 transition-transform duration-300 ease-in-out lg:self-start ${
                filterBarHidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0'
              } lg:translate-y-0`}
            >
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 grid grid-cols-3 gap-1">
                  {SOURCE_EXAM_GROUPS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => handleSourceGroupChange(g.value)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        sourceExamGroup === g.value
                          ? 'bg-[#FAB932] text-[#050f41]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  <input
                    type="text"
                    placeholder="Filtrar enunciado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
                  />
                  <select
                    value={areaFilter}
                    onChange={(e) => {
                      setAreaFilter(e.target.value);
                      setThemeFilterIds([]);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300"
                  >
                    <option value="">Todas as Áreas</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <CheckboxMultiSelect
                    label="Tema"
                    options={themesForAreaFilter.map(t => ({ id: t.id, label: t.name }))}
                    selectedIds={themeFilterIds}
                    onChange={setThemeFilterIds}
                    emptyLabel={areaFilter ? 'Todos os Temas' : 'Selecione uma área'}
                    disabled={!areaFilter}
                  />

                  <div className="relative" ref={sourceDropdownRef}>
                    <button
                      type="button"
                      disabled={sourceExamGroup === 'BANCO_PROPRIO'}
                      onClick={() => setSourceDropdownOpen(prev => !prev)}
                      title={sourceExamGroup === 'BANCO_PROPRIO' ? 'Fonte fixada em Banco Próprio pelo filtro acima' : undefined}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 flex items-center justify-between gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span className="truncate">
                        {selectedSourceExams.length === 0
                          ? 'Todas as Fontes'
                          : selectedSourceExams.length === 1
                            ? selectedSourceExams[0]
                            : `${selectedSourceExams.length} fontes selecionadas`}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${sourceDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {sourceDropdownOpen && sourceExamGroup !== 'BANCO_PROPRIO' && (
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
                        {getSourceExamOptionsForGroup(sourceExamGroup).map(opt => (
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

                <div className="pt-1 border-t border-slate-800">
                  <Switch
                    checked={showOnlySelected}
                    onChange={setShowOnlySelected}
                    label="Mostrar apenas selecionadas"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 pt-1">
                    <div className="text-center">
                      <p className="text-4xl font-extrabold text-cyan-400 leading-none">{filteredQuestions.length}</p>
                      <p className="text-[11px] text-slate-400 mt-1.5">questõe{filteredQuestions.length === 1 ? '' : 's'} filtrada{filteredQuestions.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-extrabold text-emerald-400 leading-none">{selectedQuestions.length}</p>
                      <p className="text-[11px] text-slate-400 mt-1.5">questõe{selectedQuestions.length === 1 ? '' : 's'} selecionada{selectedQuestions.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  {(searchQuery || areaFilter || themeFilterIds.length > 0 || selectedSourceExams.length > 0 || showOnlySelected) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setAreaFilter('');
                        setThemeFilterIds([]);
                        setSelectedSourceExams([]);
                        setSourceExamGroup('TODAS');
                        setShowOnlySelected(false);
                      }}
                      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-[#050f41] text-[11px] font-semibold justify-center"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Limpar Filtros</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card independente do quadro de filtros, mas dentro da
                  mesma coluna sticky, com os temas das questões já
                  selecionadas para a prova e a quantidade de cada um. */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 mt-4">
                <h3 className="text-xs font-bold text-[#050f41]">Temas das Questões Selecionadas</h3>
                {selectedThemeCounts.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Nenhuma questão selecionada ainda.</p>
                ) : (
                  <>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 text-[10px] uppercase">
                          <th className="pb-1.5 font-semibold">Tema</th>
                          <th className="pb-1.5 font-semibold text-right">Qtd.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {pagedThemeCounts.map(t => (
                          <tr key={t.themeId}>
                            <td className="py-1.5 pr-2 text-slate-300 truncate max-w-[10rem]">{t.name}</td>
                            <td className="py-1.5 text-right font-bold text-cyan-400">{t.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {themeTablePageCount > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          disabled={themeTablePage === 0}
                          onClick={() => setThemeTablePage(p => Math.max(0, p - 1))}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#050f41] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-500">Página {themeTablePage + 1} de {themeTablePageCount}</span>
                        <button
                          type="button"
                          disabled={themeTablePage >= themeTablePageCount - 1}
                          onClick={() => setThemeTablePage(p => Math.min(themeTablePageCount - 1, p + 1))}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#050f41] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Coluna única (não dupla) para a lista de questões — altura
                acompanha a do quadro lateral (filtros + tabela de temas),
                medida via ResizeObserver em sidebarColRef, para que a borda
                inferior dos dois cards fique alinhada em vez de sobrar
                espaço em branco abaixo da lista. lg:max-h-[36rem] é só o
                fallback usado antes da primeira medição. */}
            <div
              className="flex-1 min-w-0 max-h-[28rem] lg:max-h-[36rem] overflow-y-auto grid grid-cols-1 gap-3 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950"
              style={sidebarColHeight != null ? { maxHeight: sidebarColHeight } : undefined}
            >
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
