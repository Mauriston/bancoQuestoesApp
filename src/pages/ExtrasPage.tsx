import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, X, Video, Presentation, Eye, CheckCircle2, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAreas, getThemes, getVideotecaItems, createVideotecaItem, getAulaItems, createAulaItem,
  logMaterialView, getMaterialViewLogs, getViewedMaterialIds
} from '../services/firebaseService';
import { Area, Theme, VideotecaItem, AulaItem, MaterialViewLog } from '../types';
import { CheckboxMultiSelect } from '../components/CheckboxMultiSelect';
import { youTubeThumbnailUrl, youTubeEmbedUrl, toPresentEmbedUrl } from '../utils/mediaUrls';

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

  const [createOpen, setCreateOpen] = useState(false);
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
      if (themeFilterIds.length > 0 && !themeFilterIds.includes(item.themeId)) return false;
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center gap-3">
        <CheckboxMultiSelect
          label="Área"
          options={areas.map(a => ({ id: a.id, label: a.name }))}
          selectedIds={areaFilterIds}
          onChange={(ids) => { setAreaFilterIds(ids); setThemeFilterIds([]); }}
          emptyLabel="Todas as Áreas"
          className="w-48"
        />
        <CheckboxMultiSelect
          label="Tema"
          options={themesForFilter.map(t => ({ id: t.id, label: t.name }))}
          selectedIds={themeFilterIds}
          onChange={setThemeFilterIds}
          emptyLabel="Todos os Temas"
          className="w-48"
        />
        {isAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-cyan-500/20"
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
            <MaterialGrid items={groupItems} themes={themes} viewedIds={viewedIds} isAdmin={isAdmin} onOpen={handleOpenItem} />
          </div>
        ))
      ) : (
        <MaterialGrid items={items} themes={themes} viewedIds={viewedIds} isAdmin={isAdmin} onOpen={handleOpenItem} />
      )}

      {createOpen && isAdmin && (
        <CreateMaterialModal
          tab={tab}
          areas={areas}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => { setCreateOpen(false); await loadAll(); }}
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
}> = ({ items, themes, viewedIds, isAdmin, onOpen }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => {
        const themeName = themes.find(t => t.id === item.themeId)?.name;
        const thumbnail = item.kind === 'videoteca' ? youTubeThumbnailUrl(item.url) : null;
        const seen = viewedIds.has(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onOpen(item)}
            className="text-left bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all group"
          >
            <div>
              <p className="px-3 pt-3 text-sm font-bold text-[#050f41] line-clamp-2">{item.title}</p>
              {themeName && <p className="px-3 text-[11px] text-slate-400 mt-0.5">{themeName}</p>}
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
        );
      })}
    </div>
  );
};

const CreateMaterialModal: React.FC<{
  tab: MaterialTab;
  areas: Area[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ tab, areas, onClose, onCreated }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState('');
  const [themeId, setThemeId] = useState('');
  const [themeOptions, setThemeOptions] = useState<Theme[]>([]);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !areaId || !themeId || !url || !currentUser) return;
    setSubmitting(true);
    try {
      const area = areas.find(a => a.id === areaId);
      const theme = themeOptions.find(t => t.id === themeId);
      const payload = {
        title, areaId, areaName: area?.name, themeId, themeName: theme?.name,
        url, createdBy: currentUser.id
      };
      if (tab === 'videoteca') await createVideotecaItem(payload);
      else await createAulaItem(payload);
      onCreated();
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
            {tab === 'videoteca' ? 'Inserir Vídeo' : 'Inserir Aula'}
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
              onChange={async (e) => { const v = e.target.value; setAreaId(v); setThemeId(''); setThemeOptions(v ? await getThemes(v) : []); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="">Selecione a Área</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Tema *</label>
            <select required value={themeId} disabled={!areaId} onChange={e => setThemeId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 disabled:opacity-50">
              <option value="">{areaId ? 'Selecione o Tema' : 'Selecione a área primeiro'}</option>
              {themeOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {tab === 'videoteca' ? 'URL do vídeo (YouTube) *' : 'URL da apresentação (Canva ou Google Slides, modo Apresentar) *'}
            </label>
            <input required type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#050f41]" />
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
                {viewLogs.map(log => (
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
