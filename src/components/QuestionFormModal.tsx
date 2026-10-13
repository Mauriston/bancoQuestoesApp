import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  getThemes, getGroups, createTheme, getReferences, saveQuestion,
  uploadQuestionImage, deleteQuestionImage, getQuestionAnswer
} from '../services/firebaseService';
import { Question, Area, Theme, Group, Reference } from '../types';
import { QuestionImage } from './QuestionImage';

export interface SavedAnswerFields {
  correctAlternative: "A" | "B" | "C" | "D";
  comments: string;
  commentMediaUrl?: string;
  referenceId?: string;
}

interface QuestionFormModalProps {
  // null = cadastrar nova questão; com valor = editar essa questão.
  question: Question | null;
  areas: Area[];
  onClose: () => void;
  // Chamado depois de gravar no banco, com a questão e o gabarito salvos.
  onSaved: (saved: Question, answer: SavedAnswerFields) => void | Promise<void>;
  // Chamado quando um tema novo é criado pelo "+ Adicionar tema".
  onThemeCreated?: (theme: Theme) => void;
}

// Modal de cadastro/edição de questão do banco — usado pelo Banco de Questões
// e pela visualização de provas (admin).
export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({ question, areas, onClose, onSaved, onThemeCreated }) => {
  const editingQId = question?.id || null;
  const isEdit = !!editingQId;

  const [areaId, setAreaId] = useState(question?.areaId || (question ? '' : areas[0]?.id || ''));
  const [themeId, setThemeId] = useState(question?.themeId || '');
  const [addingTheme, setAddingTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeGroupId, setNewThemeGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState('');
  const [modalThemes, setModalThemes] = useState<Theme[]>([]);
  const [sourceExam, setSourceExam] = useState(question?.sourceExam || 'SBOT');
  const [statement, setStatement] = useState(question?.statement || '');
  const [altA, setAltA] = useState(question?.alternatives.A || '');
  const [altB, setAltB] = useState(question?.alternatives.B || '');
  const [altC, setAltC] = useState(question?.alternatives.C || '');
  const [altD, setAltD] = useState(question?.alternatives.D || '');
  const [correctAlt, setCorrectAlt] = useState<"A"|"B"|"C"|"D">('A');
  const [comments, setComments] = useState('');
  const [commentMediaUrl, setCommentMediaUrl] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(question?.imageUrl || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Imagem que a questão tinha ao abrir o modal — para saber se o admin
  // removeu uma imagem existente e apagar o objeto no Storage ao salvar.
  const originalImageUrl = question?.imageUrl || null;
  const removingImage = false;
  const [submitting, setSubmitting] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(isEdit);

  useEffect(() => {
    getReferences().then(setReferences).catch(err => console.error("Erro ao carregar referências:", err));
  }, []);

  // Temas da área inicial e, na edição, o gabarito atual da questão.
  useEffect(() => {
    let cancelled = false;
    const initialAreaId = question?.areaId || areas[0]?.id || '';
    if (initialAreaId) {
      getThemes(initialAreaId).then(res => { if (!cancelled) setModalThemes(res); });
    }
    if (editingQId) {
      getQuestionAnswer(editingQId)
        .then(ansKey => {
          if (cancelled || !ansKey) return;
          setCorrectAlt(ansKey.correctAlternative);
          setComments(ansKey.comments || '');
          setCommentMediaUrl(ansKey.commentMediaUrl || '');
          setReferenceId(ansKey.referenceId || '');
        })
        .catch(err => console.error("Erro ao carregar gabarito:", err))
        .finally(() => { if (!cancelled) setLoadingAnswer(false); });
    }
    return () => { cancelled = true; };
  }, []);

  const closeAddTheme = () => {
    setAddingTheme(false);
    setNewThemeName('');
    setNewThemeGroupId('');
    setThemeError('');
  };

  const handleOpenAddTheme = () => {
    setAddingTheme(true);
    if (groups.length === 0) getGroups().then(setGroups).catch(err => console.error('Erro ao carregar grupos:', err));
  };

  const handleSaveNewTheme = async () => {
    const name = newThemeName.trim();
    if (!areaId || !name) return;
    if (modalThemes.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) {
      setThemeError('Já existe um tema com esse nome nesta área.');
      return;
    }
    setSavingTheme(true);
    setThemeError('');
    try {
      const group = groups.find(g => g.id === newThemeGroupId);
      const created = await createTheme({ areaId, name, groupId: group?.id, groupName: group?.name });
      setModalThemes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onThemeCreated?.(created);
      setThemeId(created.id);
      closeAddTheme();
    } catch (err: any) {
      setThemeError('Erro ao criar tema: ' + err.message);
    } finally {
      setSavingTheme(false);
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

      const savedId = await saveQuestion(
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

      const answerFields: SavedAnswerFields = {
        correctAlternative: correctAlt,
        comments,
        commentMediaUrl: commentMediaUrl || undefined,
        referenceId: referenceId || undefined
      };
      await onSaved({
        ...(question || {}),
        id: savedId,
        areaId,
        themeId,
        sourceExam,
        statement,
        alternatives: { A: altA, B: altB, C: altC, D: altD },
        imageUrl: finalImageUrl || undefined,
        active: true
      } as Question, answerFields);
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar questão: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
            <h3 className="text-sm font-bold text-slate-100">
              {isEdit ? 'Editar Questão' : 'Cadastrar Nova Questão'}
            </h3>
            <button onClick={() => onClose()} className="text-slate-400 hover:text-slate-100">
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
                    closeAddTheme();
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
                {!addingTheme ? (
                  <button
                    type="button"
                    disabled={!areaId}
                    onClick={handleOpenAddTheme}
                    className="mt-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Adicionar tema
                  </button>
                ) : (
                  <div className="mt-2 p-3 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nome do novo tema"
                      value={newThemeName}
                      onChange={(e) => setNewThemeName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                    <select
                      value={newThemeGroupId}
                      onChange={(e) => setNewThemeGroupId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300"
                    >
                      <option value="">Grupo TEOT (opcional)</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    {themeError && <p className="text-[11px] text-red-400">{themeError}</p>}
                    <div className="flex items-center justify-end gap-3">
                      <button type="button" onClick={closeAddTheme} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingTheme || !newThemeName.trim()}
                        onClick={handleSaveNewTheme}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-40"
                      >
                        {savingTheme ? 'Salvando...' : 'Salvar tema'}
                      </button>
                    </div>
                  </div>
                )}
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
                  <QuestionImage src={imageUrl} alt="Imagem atual da questão" className="!my-0" imageClassName="max-h-40" />
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
                onClick={() => onClose()}
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
  );
};
