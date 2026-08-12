import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, X, Presentation, Download, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAreas, getThemes, subscribeSabatinas, createSabatina, updateSabatina, deleteSabatina, createNotification } from '../services/firebaseService';
import { Area, Theme, Sabatina } from '../types';
import { toPresentEmbedUrl, googleSlidesPdfExportUrl } from '../utils/mediaUrls';
import { shareOrDownloadFile, toSafeFileName } from '../utils/fileShare';
import { CheckboxMultiSelect } from '../components/CheckboxMultiSelect';

// 'YYYY-MM-DD' -> 'DD/MM/YYYY', só manipulação de string — sem passar por
// Date, para não sofrer o deslocamento de fuso horário de "new Date('YYYY-MM-DD')".
function formatIsoDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export const SabatinasPage: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [sabatinas, setSabatinas] = useState<Sabatina[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Sabatina | null>(null);
  const [viewingItem, setViewingItem] = useState<Sabatina | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Área/Tema são cadastro de referência (mudam raramente) — busca única.
  useEffect(() => {
    Promise.all([getAreas(), getThemes()])
      .then(([arList, thList]) => { setAreas(arList); setThemes(thList); })
      .catch(err => console.error("Erro ao carregar áreas/temas:", err));
  }, []);

  // Sabatinas ao vivo — uma recém-cadastrada/editada/excluída pelo admin
  // aparece na hora, sem precisar recarregar a página.
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeSabatinas((data) => {
      setSabatinas(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Agrupadas por data (ordem cronológica crescente) — cada data vira o
  // título de uma seção da página.
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Sabatina[]> = {};
    sabatinas.forEach(s => {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items: items.sort((a, b) => a.title.localeCompare(b.title)) }));
  }, [sabatinas]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Sabatina) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: Sabatina) => {
    if (!confirm(`Excluir "${item.title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteSabatina(item.id);
    } catch (err) {
      alert("Erro ao excluir sabatina.");
    }
  };

  const handleDownload = async (item: Sabatina) => {
    const pdfUrl = googleSlidesPdfExportUrl(item.url);
    if (!pdfUrl) return;
    setDownloadingId(item.id);
    try {
      await shareOrDownloadFile(pdfUrl, toSafeFileName(item.title, 'pdf'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          Sabatinas
        </h1>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Inserir Sabatina</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 text-center py-10">Carregando sabatinas...</p>
      ) : groupedByDate.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-10">Nenhuma sabatina cadastrada ainda.</p>
      ) : (
        groupedByDate.map(({ date, items }) => (
          <div key={date} className="space-y-3">
            <h2 className="text-sm font-bold text-[#050f41]">{formatIsoDateBr(date)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => {
                const themeNames = item.themeIds
                  .map(id => themes.find(t => t.id === id)?.name)
                  .filter((n): n is string => !!n);
                const embedUrl = toPresentEmbedUrl(item.url);
                const pdfUrl = googleSlidesPdfExportUrl(item.url);
                const isDownloading = downloadingId === item.id;
                return (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-xl transition-all group relative">
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                      {pdfUrl && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                          disabled={isDownloading}
                          title="Baixar apresentação em PDF"
                          className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-[#050f41] backdrop-blur-sm disabled:opacity-50"
                        >
                          <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                            title="Editar sabatina"
                            className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-[#050f41] backdrop-blur-sm"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            title="Excluir sabatina"
                            className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-red-500/20 text-red-400 hover:text-red-300 backdrop-blur-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <button onClick={() => setViewingItem(item)} className="text-left w-full">
                      <div>
                        <p className="px-3 pt-3 text-sm font-bold text-[#050f41] line-clamp-2 pr-24">{item.title}</p>
                        {themeNames.length > 0 && (
                          <div className="px-3 mt-1.5 flex flex-wrap gap-1">
                            {themeNames.map(name => (
                              <span key={name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 aspect-video bg-slate-950 relative overflow-hidden">
                        {embedUrl ? (
                          // pointer-events-none faz o clique atravessar o iframe e
                          // cair no <button> pai, abrindo o modo tela cheia.
                          <iframe src={embedUrl} title={item.title} loading="lazy" className="w-full h-full pointer-events-none" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Presentation className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {modalOpen && isAdmin && (
        <SabatinaFormModal
          areas={areas}
          editingItem={editingItem}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}

      {viewingItem && (
        <FullscreenPresentation item={viewingItem} onClose={() => setViewingItem(null)} />
      )}
    </div>
  );
};

const SabatinaFormModal: React.FC<{
  areas: Area[];
  editingItem: Sabatina | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ areas, editingItem, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState(editingItem?.title || '');
  const [date, setDate] = useState(editingItem?.date || '');
  const [areaId, setAreaId] = useState(editingItem?.areaId || '');
  const [themeIds, setThemeIds] = useState<string[]>(editingItem?.themeIds || []);
  const [themeOptions, setThemeOptions] = useState<Theme[]>([]);
  const [url, setUrl] = useState(editingItem?.url || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (areaId) getThemes(areaId).then(setThemeOptions);
    else setThemeOptions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAreaChange = async (v: string) => {
    setAreaId(v);
    setThemeIds([]);
    setThemeOptions(v ? await getThemes(v) : []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !areaId || themeIds.length === 0 || !url || !currentUser) return;
    setSubmitting(true);
    try {
      const area = areas.find(a => a.id === areaId);
      const themeNames = themeIds.map(id => themeOptions.find(t => t.id === id)?.name).filter((n): n is string => !!n);
      const payload = {
        title, date, areaId, areaName: area?.name, themeIds, themeNames,
        url, createdBy: editingItem?.createdBy || currentUser.id
      };
      if (editingItem) {
        await updateSabatina(editingItem.id, payload);
      } else {
        await createSabatina(payload);
        createNotification({
          type: 'sabatina_created',
          message: `${currentUser.name} inseriu uma nova Sabatina - ${title}`,
          audience: 'users_only',
          actorId: currentUser.id,
          actorName: currentUser.name
        }).catch(err => console.error('Erro ao criar notificação de sabatina:', err));
      }
      onSaved();
    } catch (err: any) {
      alert("Erro ao salvar sabatina: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-[#050f41]">{editingItem ? 'Editar' : 'Inserir'} Sabatina</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#050f41]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]" />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Data da Sabatina *</label>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200" />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Área *</label>
            <select required value={areaId} onChange={(e) => handleAreaChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200">
              <option value="">Selecione a Área</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Temas * <span className="font-normal text-slate-500">(pode selecionar mais de um)</span></label>
            <CheckboxMultiSelect
              label="Tema"
              options={themeOptions.map(t => ({ id: t.id, label: t.name }))}
              selectedIds={themeIds}
              onChange={setThemeIds}
              emptyLabel={areaId ? 'Selecione o(s) Tema(s)' : 'Selecione a área primeiro'}
              disabled={!areaId}
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">URL da apresentação (Google Apresentações, modo Apresentar) *</label>
            <input required type="url" placeholder="https://docs.google.com/presentation/d/..." value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white">
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FullscreenPresentation: React.FC<{ item: Sabatina; onClose: () => void }> = ({ item, onClose }) => {
  const embedUrl = toPresentEmbedUrl(item.url);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#050f41] shrink-0">
        <h3 className="text-sm font-bold text-white truncate pr-4">{item.title}</h3>
        <button onClick={onClose} className="text-white/80 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 min-h-0">
        {embedUrl ? (
          <iframe src={embedUrl} title={item.title} className="w-full h-full" allowFullScreen allow="fullscreen" />
        ) : (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center text-cyan-400 text-sm underline">
            Abrir apresentação em nova aba
          </a>
        )}
      </div>
    </div>
  );
};
