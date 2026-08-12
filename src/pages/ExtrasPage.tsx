import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, X, Video, Presentation, Eye, CheckCircle2, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAreas, getThemes, getVideotecaItems, createVideotecaItem, updateVideotecaItem, deleteVideotecaItem,
  getAulaItems, createAulaItem, updateAulaItem, deleteAulaItem,
  logMaterialView, getMaterialViewLogs, getViewedMaterialIds
} from '../services/firebaseService';
import { Area, Theme, VideotecaItem, AulaItem, MaterialViewLog } from '../types';
import { CheckboxMultiSelect } from '../components/CheckboxMultiSelect';
import { youTubeThumbnailUrl, youTubeEmbedUrl, toPresentEmbedUrl, extractEmbedSrc } from '../utils/mediaUrls';

type MaterialTab = 'videoteca' | 'aulas';
type MaterialItem = (VideotecaItem | AulaItem) & { kind: MaterialTab };

export const ExtrasPage: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [tab, setTab] = useState<MaterialTab>('videoteca');
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [videos, setVideos] = useState<VideotecaItem[]>([]);
  const [aulas, setAulas] = useState<AulaItem[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [areaFilterIds, setAreaFilterIds] = useState<string[]>([]);
  const [themeFilterIds, setThemeFilterIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [viewingItem, setViewingItem] = useState<MaterialItem | null>(null);
  const [viewLogs, setViewLogs] = useState<MaterialViewLog[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [arList, thList, vList, aList] = await Promise.all([
        getAreas(), getThemes(), getVideotecaItems(), getAulaItems()
      ]);
      setAreas(arList);
      setThemes(thList);
      setVideos(vList);
      setAulas(aList);
      if (currentUser) setViewedIds(await getViewedMaterialIds(currentUser.id));
    } catch (err) {
      console.error("Erro ao carregar Extras:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentUser?.id]);

  const items: MaterialItem[] = useMemo(() => {
    const base = tab === 'videoteca' ? videos.map(v => ({ ...v, kind: 'videoteca' as const })) : aulas.map(a => ({ ...a, kind: 'aulas' as const }));
    return base.filter(item => {
      if (areaFilterIds.length > 0 && !areaFilterIds.includes(item.areaId)) return false;
      if (themeFilterIds.length > 0 && !item.themeIds.some(id => themeFilterIds.includes(id))) return false;
      return true;
    });
  }, [tab, videos, aulas, areaFilterIds, themeFilterIds]);

  const hasActiveFilter = areaFilterIds.length > 0 || themeFilterIds.length > 0;

  // Sem filtro ativo: agrupado por área. Com filtro: lista simples.
  const groupedByArea = useMemo(() => {
    if (hasActiveFilter) return null;
    const groups: Record<string, MaterialItem[]> = {};
    items.forEach(item => {
      const areaName = areas.find(a => a.id === item.areaId)?.name || 'Outros';
      if (!groups[areaName]) groups[areaName] = [];
      groups[areaName].push(item);
    });
    return groups;
  }, [items, areas, hasActiveFilter]);

  const themesForFilter = areaFilterIds.length > 0 ? themes.filter(t => areaFilterIds.includes(t.areaId)) : themes;

  const handleOpenItem = async (item: MaterialItem) => {
    setViewingItem(item);
    setViewLogs([]);
    if (currentUser) {
      await logMaterialView(item.id, item.kind === 'videoteca' ? 'video' : 'aula', currentUser.id, currentUser.name);
      setViewedIds(prev => new Set(prev).add(item.id));
    }
    if (isAdmin) {
      getMaterialViewLogs(item.id).then(setViewLogs).catch(() => {});
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: MaterialItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: MaterialItem) => {
    if (!confirm(`Excluir "${item.title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      if (item.kind === 'videoteca') await deleteVideotecaItem(item.id);
      else await deleteAulaItem(item.id);
      await loadAll();
    } catch (err) {
      alert("Erro ao excluir material.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          Extras
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 w-fit">
        {(['videoteca', 'aulas'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setAreaFilterIds([]); setThemeFilterIds([]); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'videoteca' ? 'Videoteca' : 'Aulas'}
          </button>
        ))}
      </div>

      {/* Filtros + botão de inserir (admin) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <CheckboxMultiSelect
            label="Área"
            options={areas.map(a => ({ id: a.id, label: a.name }))}
            selectedIds={areaFilterIds}
            onChange={(ids) => { setAreaFilterIds(ids); setThemeFilterIds([]); }}
            emptyLabel="Todas as Áreas"
            className="w-full sm:w-48"
          />
          <CheckboxMultiSelect
            label="Tema"
            options={themesForFilter.map(t => ({ id: t.id, label: t.name }))}
            selectedIds={themeFilterIds}
            onChange={setThemeFilterIds}
            emptyLabel="Todos os Temas"
            className="w-full sm:w-48"
          />
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="sm:ml-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            {tab === 'videoteca' ? 'Inserir Vídeo' : 'Inserir Aula'}
          </button>
        )}
      </div>

      {/* Deck de materiais */}
      {loading ? (
        <p className="text-xs text-slate-500 text-center py-10">Carregando materiais...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-10">Nenhum material encontrado para os filtros atuais.</p>
      ) : groupedByArea ? (
        Object.entries(groupedByArea).map(([areaName, groupItems]) => (
          <div key={areaName} className="space-y-3">
            <h2 className="text-sm font-bold text-[#050f41]">{areaName}</h2>
            <MaterialGrid items={groupItems} themes={themes} viewedIds={viewedIds} isAdmin={isAdmin} onOpen={handleOpenItem} onEdit={handleOpenEdit} onDelete={handleDelete} />
          </div>
        ))
      ) : (
        <MaterialGrid items={items} themes={themes} viewedIds={viewedIds} isAdmin={isAdmin} onOpen={handleOpenItem} onEdit={handleOpenEdit} onDelete={handleDelete} />
      )}

      {modalOpen && isAdmin && (
        <MaterialFormModal
          tab={tab}
          areas={areas}
          editingItem={editingItem}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await loadAll(); }}
        />
      )}

      {viewingItem && (
        <ViewMaterialModal
          item={viewingItem}
          isAdmin={isAdmin}
          viewLogs={viewLogs}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  );
};

const MaterialGrid: React.FC<{
  items: MaterialItem[];
  themes: Theme[];
  viewedIds: Set<string>;
  isAdmin: boolean;
  onOpen: (item: MaterialItem) => void;
  onEdit: (item: MaterialItem) => void;
  onDelete: (item: MaterialItem) => void;
}> = ({ items, themes, viewedIds, isAdmin, onOpen, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => {
        const themeNames = item.themeIds
          .map(id => themes.find(t => t.id === id)?.name)
          .filter((n): n is string => !!n);
        const thumbnail = item.kind === 'videoteca' ? youTubeThumbnailUrl(item.url) : null;
        const seen = viewedIds.has(item.id);
        return (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all group relative"
          >
            {isAdmin && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                  title="Editar material"
                  className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-[#050f41] backdrop-blur-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  title="Excluir material"
                  className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-red-500/20 text-red-400 hover:text-red-300 backdrop-blur-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button onClick={() => onOpen(item)} className="text-left w-full">
              <div>
                <p className="px-3 pt-3 text-sm font-bold text-[#050f41] line-clamp-2 pr-14">{item.title}</p>
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
                {thumbnail ? (
                  <img src={thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Presentation className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  {item.kind === 'videoteca' ? (
                    <Video className="w-4 h-4 text-white drop-shadow" />
                  ) : (
                    <Presentation className="w-4 h-4 text-white drop-shadow" />
                  )}
                </div>
                {!isAdmin && seen && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/80 text-white">
                    <CheckCircle2 className="w-3 h-3" />
                    Visto
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
};

const MaterialFormModal: React.FC<{
  tab: MaterialTab;
  areas: Area[];
  editingItem: MaterialItem | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ tab, areas, editingItem, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState(editingItem?.title || '');
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
    if (!title || !areaId || themeIds.length === 0 || !url || !currentUser) return;
    setSubmitting(true);
    try {
      const area = areas.find(a => a.id === areaId);
      const themeNames = themeIds.map(id => themeOptions.find(t => t.id === id)?.name).filter((n): n is string => !!n);
      // Em "Aulas" aceitamos tanto uma URL quanto o código de incorporação em
      // HTML (<iframe ...>) do Canva/Slides — extrai o src antes de salvar,
      // já que o restante do app (embed, thumbnail, CSV) trabalha com URL.
      const finalUrl = tab === 'aulas' ? extractEmbedSrc(url) : url;
      const payload = {
        title, areaId, areaName: area?.name, themeIds, themeNames,
        url: finalUrl, createdBy: editingItem?.createdBy || currentUser.id
      };
      if (editingItem) {
        if (tab === 'videoteca') await updateVideotecaItem(editingItem.id, payload);
        else await updateAulaItem(editingItem.id, payload);
      } else {
        if (tab === 'videoteca') await createVideotecaItem(payload);
        else await createAulaItem(payload);
      }
      onSaved();
    } catch (err: any) {
      alert("Erro ao salvar material: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-[#050f41]">
            {editingItem ? 'Editar' : 'Inserir'} {tab === 'videoteca' ? 'Vídeo' : 'Aula'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#050f41]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]" />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Área *</label>
            <select
              required value={areaId}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="">Selecione a Área</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Temas * <span className="font-normal text-slate-500">(um material pode pertencer a mais de um tema)</span></label>
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
            <label className="block text-slate-300 font-medium mb-1">
              {tab === 'videoteca' ? 'URL do vídeo (YouTube) *' : 'Código de incorporação do Canva ou URL do Google Slides *'}
            </label>
            {tab === 'videoteca' ? (
              <input required type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]" />
            ) : (
              <>
                <textarea
                  required
                  rows={4}
                  placeholder='Cole aqui o <iframe> de "Compartilhar > Incorporar" do Canva, ou a URL de apresentação do Google Slides'
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41] font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-500 mt-1">No Canva: Compartilhar → Mais → Incorporar → copiar código e colar aqui.</p>
              </>
            )}
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

const ViewMaterialModal: React.FC<{
  item: MaterialItem;
  isAdmin: boolean;
  viewLogs: MaterialViewLog[];
  onClose: () => void;
}> = ({ item, isAdmin, viewLogs, onClose }) => {
  const embedUrl = item.kind === 'videoteca' ? youTubeEmbedUrl(item.url) : toPresentEmbedUrl(item.url);

  // A lista mostra cada usuário uma única vez (mantendo a visualização mais
  // recente, já que viewLogs vem ordenado desc por viewedAt), mas o total
  // entre parênteses continua sendo a soma bruta de visualizações, sem
  // deduplicar.
  const uniqueViewers = viewLogs.filter((log, idx) => viewLogs.findIndex(l => l.userId === log.userId) === idx);

  return (
    <div className="fixed inset-0 z-50 bg-[#050f41]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h3 className="text-sm font-bold text-[#050f41] truncate pr-4">{item.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#050f41] shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe src={embedUrl} title={item.title} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          ) : (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center text-cyan-400 text-sm underline">
              Abrir material em nova aba
            </a>
          )}
        </div>
        {isAdmin && (
          <div className="p-5 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5 text-cyan-400" />
              Visualizações ({viewLogs.length})
            </h4>
            {viewLogs.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">Ninguém visualizou este material ainda.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto text-[11px] text-slate-400">
                {uniqueViewers.map(log => (
                  <li key={log.id} className="flex items-center justify-between border-b border-slate-800/60 py-1 last:border-0">
                    <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" />{log.userName || log.userId}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
