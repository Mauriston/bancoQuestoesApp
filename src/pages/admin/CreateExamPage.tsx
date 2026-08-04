import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, FileCheck, Search, AlertCircle, Sparkles, Eye, Image as ImageIcon, XCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getQuestions, getAreas, getThemes, getActiveUsers, createAndPublishExam } from '../../services/firebaseService';
import { Question, Area, Theme, AppUser } from '../../types';
import { QuestionPreviewModal } from '../../components/QuestionPreviewModal';

export const CreateExamPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  // Step 1: Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

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
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadResources();
  }, []);

  const themesForAreaFilter = areaFilter ? themes.filter(t => t.areaId === areaFilter) : themes;

  const filteredQuestions = allQuestions.filter(q => {
    const matchesArea = !areaFilter || q.areaId === areaFilter;
    const matchesTheme = !themeFilter || q.themeId === themeFilter;
    const matchesSearch = !searchQuery || q.statement.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesArea && matchesTheme && matchesSearch;
  });

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
          description,
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

  return (
    <div className="space-y-6 pb-12">
      
      <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Lista de Provas</span>
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          Assistente de Criação de Prova
        </h1>
        <p className="text-xs text-slate-400 mt-1">Siga as 4 etapas para publicar um novo simulado.</p>
      </div>

      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 text-xs font-semibold">
        <span className={step >= 1 ? 'text-cyan-400' : 'text-slate-500'}>1. Dados Básicos</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className={step >= 2 ? 'text-cyan-400' : 'text-slate-500'}>2. Seleção de Questões ({selectedQuestions.length})</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className={step >= 3 ? 'text-cyan-400' : 'text-slate-500'}>3. Atribuição de Usuários</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className={step >= 4 ? 'text-cyan-400' : 'text-slate-500'}>4. Revisão e Publicação</span>
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
          
          <div>
            <label className="block text-slate-300 font-medium mb-1">Descrição / Instruções aos Candidatos</label>
            <textarea
              rows={3}
              placeholder="Descreva o conteúdo cobrado ou orientações gerais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300"
            >
              <option value="">Todas as Áreas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
          </div>

          {(searchQuery || areaFilter || themeFilter) && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setAreaFilter('');
                  setThemeFilter('');
                }}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-[#050f41] text-[11px] font-semibold"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950">
            {filteredQuestions.map(q => {
              const isSelected = selectedQuestions.some(sq => sq.id === q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleQuestionSelect(q)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
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
                      className="w-12 h-12 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-xs leading-relaxed line-clamp-2">{q.statement}</p>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                      <span>{q.areaName} • {q.themeName}</span>
                      {q.imageUrl && <ImageIcon className="w-3 h-3 text-teal-400" />}
                    </p>
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
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-5 rounded-xl disabled:opacity-40"
            >
              <span>Avançar para Atribuição de Usuários</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: User Assignment */}
      {step === 3 && (
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
                  <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-900 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds(prev => [...prev, u.id]);
                        else setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                      }}
                    />
                    <span className="text-slate-200">{u.name} ({u.email})</span>
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

      {/* STEP 4: Review & Publish */}
      {step === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[#050f41] border-b border-slate-800 pb-3">
            Etapa 4: Resumo e Confirmação de Publicação
          </h2>
          
          <div className="space-y-2 text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p>• Nome da Prova: <strong className="text-[#050f41]">{name}</strong></p>
            <p>• Total de Questões: <strong className="text-teal-400">{selectedQuestions.length}</strong></p>
            <p>• Destinatários: <strong className="text-cyan-400">{assignMode === 'all' ? `Todos os ${activeUsers.length} usuários ativos` : `${selectedUserIds.length} usuários`}</strong></p>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            A prova é criada <strong>inativa</strong>. Os destinatários só vão vê-la e poder iniciá-la depois que você ativá-la em "Provas e Simulados".
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">
              Voltar
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{publishing ? 'Publicando...' : 'Publicar Prova Agora'}</span>
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
