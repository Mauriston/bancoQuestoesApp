import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen, Plus, Search, Filter, Image as ImageIcon, Camera, Trash2, Edit, AlertCircle, X, Check, Upload, CheckCircle2, ChevronDown
} from 'lucide-react';
import { getQuestions, getAreas, getThemes, getReferences, saveQuestion, deleteQuestion, uploadQuestionImage, deleteQuestionImage, getQuestionAnswer, getQuestionAnswersByIds } from '../../services/firebaseService';
import { Question, Area, Theme, QuestionAnswer, Reference } from '../../types';
import { SOURCE_EXAM_GROUPS, SourceExamGroup, getSourceExamOptionsForGroup, getSourceExamChipClass } from '../../constants';
import { QuestionPreviewModal } from '../../components/QuestionPreviewModal';
import { CheckboxMultiSelect } from '../../components/CheckboxMultiSelect';
import { QuestionImage } from '../../components/QuestionImage';
import { AddQuestionImageModal } from '../../components/AddQuestionImageModal';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';

export const QuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  // Gabarito de cada questão listada, buscado em lote (ver getQuestionAnswersByIds)
  // para mostrar a alternativa correta abaixo do enunciado sem 1 leitura por linha.
  const [answersById, setAnswersById] = useState<Record<string, QuestionAnswer>>({});

  // Filters
  const [selectedAreaId, setSelectedAreaId] = useState('');
  // Tema em caixas de seleção (multi-seleção) — o filtro server-side de
  // getQuestions só suporta um themeId por vez, então quando há mais de um
  // tema selecionado buscamos por área/fonte e filtramos o tema no cliente.
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Fonte da Questão: menu suspenso com caixas de seleção, com a lista fixa
  // de fontes definida pelo admin (ver SOURCE_EXAM_OPTIONS).
  const [selectedSourceExams, setSelectedSourceExams] = useState<string[]>([]);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  // Filtro rápido acima do dropdown de fontes (Todas/TEOT/TARO/Banco
  // Próprio) — restringe as opções exibidas no dropdown e, no caso de Banco
  // Próprio, força a seleção única e trava o dropdown em modo somente
  // leitura (ver handleSourceGroupChange).
  const [sourceExamGroup, setSourceExamGroup] = useState<SourceExamGroup>('TODAS');

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

  // Full-question preview modal (exatamente como o candidato vê na prova)
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

  // Modal exclusivo para anexar imagem a uma questão sem imagem, sem abrir
  // o modal completo de edição (ver AddQuestionImageModal).
  const [addingImageQuestion, setAddingImageQuestion] = useState<Question | null>(null);

  // Edit/Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQId, setEditingQId] = useState<string | null>(null);

  const [areaId, setAreaId] = useState('');
  const [themeId, setThemeId] = useState('');
  // Temas do formulário do modal, dependentes da área escolhida ali dentro —
  // mantidos separados de `themes` (que alimenta o filtro da listagem) para
  // que escolher uma área no modal não altere o filtro da tela por trás dele.
  const [modalThemes, setModalThemes] = useState<Theme[]>([]);
  const [sourceExam, setSourceExam] = useState('SBOT');
  const [statement, setStatement] = useState('');
  const [altA, setAltA] = useState('');
  const [altB, setAltB] = useState('');
  const [altC, setAltC] = useState('');
  const [altD, setAltD] = useState('');
  const [correctAlt, setCorrectAlt] = useState<"A"|"B"|"C"|"D">('A');
  const [comments, setComments] = useState('');
  const [commentMediaUrl, setCommentMediaUrl] = useState('');
  // Referência bibliográfica do gabarito (ver Reference/coleção `reference`)
  // — '' = nenhuma. Lista carregada uma vez (coleção pequena, muda raro).
  const [referenceId, setReferenceId] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Imagem que a questão tinha ao abrir o modal de edição — usado para saber
  // se o admin removeu uma imagem existente (ver handleRemoveImage) e, nesse
  // caso, apagar de fato o objeto no Storage ao salvar.
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchQuestionsList = async () => {
    setLoading(true);
    try {
      const [qListRaw, arList, thList] = await Promise.all([
        getQuestions({
          areaId: selectedAreaId || undefined,
          themeId: selectedThemeIds.length === 1 ? selectedThemeIds[0] : undefined,
          sourceExamIn: selectedSourceExams.length > 0 ? selectedSourceExams : undefined,
          searchQuery: searchQuery || undefined
        }),
        getAreas(),
        getThemes(selectedAreaId || undefined)
      ]);
      const qList = selectedThemeIds.length > 1
        ? qListRaw.filter(q => selectedThemeIds.includes(q.themeId))
        : qListRaw;
      setQuestions(qList);
      setAreas(arList);
      setThemes(thList);
      getQuestionAnswersByIds(qList.map(q => q.id))
        .then(setAnswersById)
        .catch(err => console.error("Erro ao carregar gabaritos:", err));
    } catch (err) {
      console.error("Erro ao carregar questões:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsList();
  }, [selectedAreaId, selectedThemeIds, selectedSourceExams, searchQuery]);

  useEffect(() => {
    getReferences().then(setReferences).catch(err => console.error("Erro ao carregar referências:", err));
  }, []);

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

  const toggleSourceExam = (value: string) => {
    setSelectedSourceExams(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleOpenCreateModal = async () => {
    const defaultAreaId = areas[0]?.id || '';
    setEditingQId(null);
    setAreaId(defaultAreaId);
    setThemeId('');
    setSourceExam('SBOT');
    setStatement('');
    setAltA('');
    setAltB('');
    setAltC('');
    setAltD('');
    setCorrectAlt('A');
    setComments('');
    setCommentMediaUrl('');
    setReferenceId('');
    setImageUrl(null);
    setImageFile(null);
    setOriginalImageUrl(null);
    setModalThemes(defaultAreaId ? await getThemes(defaultAreaId) : []);
    setModalOpen(true);
  };

  const handleOpenEditModal = async (q: Question) => {
    setEditingQId(q.id);
    setAreaId(q.areaId);
    setThemeId(q.themeId);
    setSourceExam(q.sourceExam);
    setStatement(q.statement);
    setAltA(q.alternatives.A);
    setAltB(q.alternatives.B);
    setAltC(q.alternatives.C);
    setAltD(q.alternatives.D);
    setImageUrl(q.imageUrl || null);
    setImageFile(null);
    setOriginalImageUrl(q.imageUrl || null);
    setModalThemes(await getThemes(q.areaId));

    // Fetch answer key
    const ansKey = await getQuestionAnswer(q.id);
    if (ansKey) {
      setCorrectAlt(ansKey.correctAlternative);
      setComments(ansKey.comments || '');
      setCommentMediaUrl(ansKey.commentMediaUrl || '');
      setReferenceId(ansKey.referenceId || '');
    } else {
      setReferenceId('');
    }

    setModalOpen(true);
  };

  const handleDelete = async (qId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta questão?")) return;
    try {
      await deleteQuestion(qId);
      await fetchQuestionsList();
    } catch (err) {
      alert("Erro ao excluir questão.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaId || !themeId || !statement) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      let finalImageUrl = imageUrl;

      // If a new image was picked, upload to Firebase Storage
      if (imageFile) {
        const qIdToUse = editingQId || 'q_' + Date.now();
        finalImageUrl = await uploadQuestionImage(qIdToUse, imageFile);
      } else if (editingQId && originalImageUrl && !imageUrl) {
        // Imagem existente foi removida (botão "Remover imagem") e nenhuma
        // nova foi escolhida — apaga de fato o objeto no Storage e limpa o
        // campo, já que saveQuestion() com merge:true não removeria um
        // campo simplesmente por vir undefined.
        await deleteQuestionImage(editingQId, originalImageUrl);
        finalImageUrl = null;
      }

      await saveQuestion(
        {
          id: editingQId || undefined,
          areaId,
          themeId,
          sourceExam,
          statement,
          alternatives: { A: altA, B: altB, C: altC, D: altD },
          imageUrl: finalImageUrl || undefined,
          active: true
        },
        {
          correctAlternative: correctAlt,
          comments,
          commentMediaUrl: commentMediaUrl || undefined,
          referenceId: referenceId || undefined
        }
      );

      setModalOpen(false);
      await fetchQuestionsList();
    } catch (err: any) {
      alert("Erro ao salvar questão: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Banco de Questões
          </h1>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Questão</span>
        </button>
      </div>

      {/* Filter Bar + Questions List — no desktop (lg+) a barra de filtros
          vira uma sidebar fixa ao lado do card de questões (sticky, some do
          fluxo do scroll); no mobile continua acima da lista, mas some ao
          rolar para baixo e reaparece ao rolar para cima (useHideOnScroll).
          z-20 (não z-30) de propósito: a sidebar do AdminLayout usa z-30 no
          desktop para se sobrepor ao conteúdo quando expande em overlay ao
          passar o mouse; com z-30 aqui também, o empate de z-index
          (desempatado pela ordem no DOM) fazia esta barra ficar por cima da
          sidebar expandida em vez do contrário.
          Sem overflow-y-auto/max-h aqui: esse card não tem conteúdo alto o
          bastante para precisar rolar, e um container com overflow corta
          (clipa) os menus suspensos absolutamente posicionados dentro dele
          assim que ultrapassam a borda — era isso que fazia os dropdowns de
          Tema/Fonte parecerem "sumir atrás" do fundo da página. */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
        <div
          className={`lg:w-72 xl:w-80 shrink-0 sticky top-16 lg:top-20 z-20 transition-transform duration-300 ease-in-out lg:self-start ${
            filterBarHidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0'
          } lg:translate-y-0`}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 grid grid-cols-3 gap-1">
              {SOURCE_EXAM_GROUPS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => handleSourceGroupChange(g.value)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    sourceExamGroup === g.value
                      ? 'bg-cyan-500 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar enunciado..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={selectedAreaId}
                onChange={(e) => {
                  setSelectedAreaId(e.target.value);
                  setSelectedThemeIds([]);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Todas as Áreas</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <CheckboxMultiSelect
                label="Tema"
                options={themes.map(t => ({ id: t.id, label: t.name }))}
                selectedIds={selectedThemeIds}
                onChange={setSelectedThemeIds}
                emptyLabel="Todos os Temas"
              />

              <div className="relative" ref={sourceDropdownRef}>
                <button
                  type="button"
                  disabled={sourceExamGroup === 'BANCO_PROPRIO'}
                  onClick={() => setSourceDropdownOpen(prev => !prev)}
                  title={sourceExamGroup === 'BANCO_PROPRIO' ? 'Fonte fixada em Banco Próprio pelo filtro acima' : undefined}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 flex items-center justify-between gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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

            <div className="text-center pt-1">
              <p className="text-4xl font-extrabold text-cyan-400 leading-none">{questions.length}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">questõe{questions.length === 1 ? '' : 's'} filtrada{questions.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Carregando questões do banco...</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Nenhuma questão encontrada para estes filtros.</div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {questions.map((q) => {
                const answer = answersById[q.id];
                return (
                <div
                  key={q.id}
                  onClick={() => setViewingQuestion(q)}
                  className="p-4 sm:p-5 lg:p-6 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 lg:gap-6 cursor-pointer"
                  title="Clique para visualizar a questão completa"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1 lg:max-w-4xl">
                    {q.imageUrl && (
                      <img
                        src={q.imageUrl}
                        alt="Miniatura da imagem da questão"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                      />
                    )}
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceExamChipClass(q.sourceExam)}`}>
                          {q.sourceExam}
                        </span>
                      </div>

                      <p className="text-sm sm:text-base font-semibold text-slate-100 line-clamp-2 leading-relaxed">
                        {q.statement}
                      </p>

                      {answer && (
                        <p className="text-xs sm:text-sm text-emerald-400 flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="flex items-baseline gap-1 min-w-0">
                            <strong className="font-bold shrink-0">{answer.correctAlternative})</strong>
                            <span className="truncate">{q.alternatives[answer.correctAlternative]}</span>
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 self-end sm:self-auto">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(q); }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
                        title="Editar Questão"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                        title="Excluir Questão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {!q.imageUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddingImageQuestion(q); }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
                        title="Adicionar Imagem"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-sm font-bold text-slate-100">
                {editingQId ? 'Editar Questão' : 'Cadastrar Nova Questão'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Área *</label>
                  <select
                    value={areaId}
                    onChange={(e) => {
                      const newAreaId = e.target.value;
                      setAreaId(newAreaId);
                      setThemeId('');
                      getThemes(newAreaId || undefined).then(res => setModalThemes(res));
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="">Selecione a Área</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tema *</label>
                  <select
                    value={themeId}
                    onChange={(e) => setThemeId(e.target.value)}
                    required
                    disabled={!areaId}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 disabled:opacity-50"
                  >
                    <option value="">{areaId ? 'Selecione o Tema' : 'Selecione a área primeiro'}</option>
                    {modalThemes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Enunciado *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Informe o enunciado completo da questão..."
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              {/* Alternatives */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-medium">Alternativas A, B, C e D *</label>
                {(['A', 'B', 'C', 'D'] as const).map((altKey) => {
                  const val = altKey === 'A' ? altA : altKey === 'B' ? altB : altKey === 'C' ? altC : altD;
                  const setVal = altKey === 'A' ? setAltA : altKey === 'B' ? setAltB : altKey === 'C' ? setAltC : setAltD;

                  return (
                    <div key={altKey} className="flex items-center gap-2">
                      <span className="w-6 font-bold text-teal-400">{altKey})</span>
                      <input
                        type="text"
                        required
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={`Texto da alternativa ${altKey}`}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Gabarito Correto *</label>
                  <select
                    value={correctAlt}
                    onChange={(e) => setCorrectAlt(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-teal-400 font-bold"
                  >
                    <option value="A">Alternativa A</option>
                    <option value="B">Alternativa B</option>
                    <option value="C">Alternativa C</option>
                    <option value="D">Alternativa D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Prova de Origem</label>
                  <input
                    type="text"
                    value={sourceExam}
                    onChange={(e) => setSourceExam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Imagem da Questão (Upload Firebase Storage)</label>
                <div className="flex items-start gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-400"
                  />
                  {imageUrl && !imageFile && (
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      disabled={removingImage}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 font-semibold disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover imagem
                    </button>
                  )}
                </div>
                {imageUrl && !imageFile && (
                  <div className="mt-2">
                    <QuestionImage src={imageUrl} alt="Imagem atual da questão" className="max-h-40 rounded-xl border border-slate-800" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Comentários do Gabarito</label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Referência Bibliográfica</label>
                <select
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                >
                  <option value="">Nenhuma</option>
                  {references.map(r => <option key={r.id} value={r.id}>{r.referenceId}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Mídia do Comentário (URL de imagem ou vídeo do YouTube)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={commentMediaUrl}
                  onChange={(e) => setCommentMediaUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Questão'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {viewingQuestion && (
        <QuestionPreviewModal question={viewingQuestion} onClose={() => setViewingQuestion(null)} />
      )}

      {addingImageQuestion && (
        <AddQuestionImageModal
          questionId={addingImageQuestion.id}
          onClose={() => setAddingImageQuestion(null)}
          onSaved={() => fetchQuestionsList()}
        />
      )}

    </div>
  );
};
