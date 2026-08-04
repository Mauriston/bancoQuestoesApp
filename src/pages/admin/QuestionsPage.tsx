import React, { useEffect, useState } from 'react';
import {
  BookOpen, Plus, Search, Filter, Image as ImageIcon, Trash2, Edit, AlertCircle, X, Check, Upload
} from 'lucide-react';
import { getQuestions, getAreas, getThemes, saveQuestion, deleteQuestion, uploadQuestionImage, getQuestionAnswer } from '../../services/firebaseService';
import { Question, Area, Theme } from '../../types';
import { QuestionPreviewModal } from '../../components/QuestionPreviewModal';

export const QuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [sourceExamFilter, setSourceExamFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasImageFilter, setHasImageFilter] = useState<boolean | undefined>(undefined);

  // Full-question preview modal (exatamente como o candidato vê na prova)
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

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
  const [solutionText, setSolutionText] = useState('');
  const [comments, setComments] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchQuestionsList = async () => {
    setLoading(true);
    try {
      const [qList, arList, thList] = await Promise.all([
        getQuestions({
          areaId: selectedAreaId || undefined,
          themeId: selectedThemeId || undefined,
          sourceExam: sourceExamFilter || undefined,
          hasImage: hasImageFilter,
          searchQuery: searchQuery || undefined
        }),
        getAreas(),
        getThemes(selectedAreaId || undefined)
      ]);
      setQuestions(qList);
      setAreas(arList);
      setThemes(thList);
    } catch (err) {
      console.error("Erro ao carregar questões:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsList();
  }, [selectedAreaId, selectedThemeId, sourceExamFilter, hasImageFilter, searchQuery]);

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
    setSolutionText('');
    setComments('');
    setImageUrl(null);
    setImageFile(null);
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
    setModalThemes(await getThemes(q.areaId));

    // Fetch answer key
    const ansKey = await getQuestionAnswer(q.id);
    if (ansKey) {
      setCorrectAlt(ansKey.correctAlternative);
      setSolutionText(ansKey.solutionText || '');
      setComments(ansKey.comments || '');
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
          solutionText,
          comments
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
          <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Banco de Questões
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre, edite e organize o acervo de questões por Área e Tema TEOT.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Questão</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Pesquisar enunciado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={selectedAreaId}
          onChange={(e) => {
            setSelectedAreaId(e.target.value);
            setSelectedThemeId('');
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todas as Áreas</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={selectedThemeId}
          onChange={(e) => setSelectedThemeId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todos os Temas</option>
          {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select
          value={hasImageFilter === undefined ? 'all' : hasImageFilter ? 'yes' : 'no'}
          onChange={(e) => {
            const v = e.target.value;
            setHasImageFilter(v === 'all' ? undefined : v === 'yes');
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">Todas as Questões</option>
          <option value="yes">Apenas Com Imagem</option>
          <option value="no">Sem Imagem</option>
        </select>
      </div>

      {/* Questions List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Carregando questões do banco...</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Nenhuma questão encontrada para estes filtros.</div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {questions.map((q) => (
              <div
                key={q.id}
                onClick={() => setViewingQuestion(q)}
                className="p-4 sm:p-5 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                title="Clique para visualizar a questão completa"
              >
                <div className="flex items-start gap-3 max-w-3xl">
                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="Miniatura da imagem da questão"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                  )}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase font-bold">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {q.areaName || q.areaId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {q.themeName || q.themeId}
                      </span>
                      {q.imageUrl && (
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Com Imagem
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-[#050f41] line-clamp-2 leading-relaxed">
                      {q.statement}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(q); }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#050f41] transition-colors"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-sm font-bold text-[#050f41]">
                {editingQId ? 'Editar Questão' : 'Cadastrar Nova Questão'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-[#050f41]">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
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
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[#050f41]"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Imagem da Questão (Upload Firebase Storage)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Texto da Solução Explicativa</label>
                <textarea
                  rows={2}
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Comentários do Gabarito</label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]"
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

    </div>
  );
};
