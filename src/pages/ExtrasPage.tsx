import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Video, Presentation, Eye, CheckCircle2, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAreas, getThemes, subscribeVideotecaItems, createVideotecaItem, updateVideotecaItem, deleteVideotecaItem,
  subscribeAulaItems, createAulaItem, updateAulaItem, deleteAulaItem, createNotification,
  logMaterialView, subscribeAllMaterialViewLogs, subscribeViewedMaterialIds
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
  // Todos os registros de visualização, carregados uma única vez (admin) —
  // alimenta tanto o badge de contagem em cada card quanto a lista do modal
  // de detalhes, sem precisar de 1 consulta por material.
  const [allViewLogs, setAllViewLogs] = useState<MaterialViewLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [areaFilterIds, setAreaFilterIds] = useState<string[]>([]);
  const [themeFilterIds, setThemeFilterIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [viewingItem, setViewingItem] = useState<MaterialItem | null>(null);

  // Área/Tema são cadastro de referência (mudam raramente) — busca única.
  useEffect(() => {
    Promise.all([getAreas(), getThemes()])
      .then(([arList, thList]) => { setAreas(arList); setThemes(thList); })
      .catch(err => console.error("Erro ao carregar áreas/temas:", err));
  }, []);

  // Materiais e visualizações ao vivo — um vídeo/aula inserido, editado ou
  // excluído pelo admin, e cada nova visualização registrada, aparecem na
  // hora para quem estiver com a página aberta.
  useEffect(() => {
    setLoading(true);
    let videosLoaded = false;
    let aulasLoaded = false;
    const maybeStopLoading = () => {
      if (videosLoaded && aulasLoaded) setLoading(false);
    };

    const unsubVideos = subscribeVideotecaItems((data) => { setVideos(data); videosLoaded = true; maybeStopLoading(); });
    const unsubAulas = subscribeAulaItems((data) => { setAulas(data); aulasLoaded = true; maybeStopLoading(); });
    const unsubViewed = currentUser ? subscribeViewedMaterialIds(currentUser.id, setViewedIds) : null;
    const unsubAllLogs = isAdmin ? subscribeAllMaterialViewLogs(setAllViewLogs) : null;

    return () => {
      unsubVideos();
      unsubAulas();
      unsubViewed?.();
      unsubAllLogs?.();
    };
  }, [currentUser, isAdmin]);

  // Materiais da tab atual, sem os filtros de Área/Tema aplicados — base
  // tanto para a listagem filtrada abaixo quanto para restringir as opções
  // dos próprios menus de filtro (ver availableAreas/availableThemes).
  const tabItems: MaterialItem[] = useMemo(() => {
    return tab === 'videoteca'
      ? videos.map(v => ({ ...v, kind: 'videoteca' as const }))
      : aulas.map(a => ({ ...a, kind: 'aulas' as const }));
  }, [tab, videos, aulas]);

  const items: MaterialItem[] = useMemo(() => {
    const areaNameOf = (item: MaterialItem) => areas.find(a => a.id === item.areaId)?.name || item.areaName || 'Outros';
    return tabItems
      .filter(item => {
        if (areaFilterIds.length > 0 && !areaFilterIds.includes(item.areaId)) return false;
        if (themeFilterIds.length > 0 && !item.themeIds.some(id => themeFilterIds.includes(id))) return false;
        return true;
      })
      // Área (A→Z) e, dentro dela, título (A→Z) — vale tanto para a
      // listagem agrupada por área quanto para a lista simples com filtro.
      .sort((a, b) => areaNameOf(a).localeCompare(areaNameOf(b)) || a.title.localeCompare(b.title));
  }, [tabItems, areaFilterIds, themeFilterIds, areas]);

  // Só oferece nos menus suspensos as Áreas/Temas que de fato têm algum
  // material cadastrado na tab atual (Videoteca ou Aulas).
  const availableAreaIds = useMemo(() => new Set(tabItems.map(i => i.areaId)), [tabItems]);
  const availableThemeIds = useMemo(() => new Set(tabItems.flatMap(i => i.themeIds)), [tabItems]);
  const availableAreas = useMemo(() => areas.filter(a => availableAreaIds.has(a.id)), [areas, availableAreaIds]);

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

  const themesForFilter = themes.filter(t =>
    availableThemeIds.has(t.id) && (areaFilterIds.length === 0 || areaFilterIds.includes(t.areaId))
  );

  // Materiais ainda não vistos pelo usuário, por tab — badge nas abas
  // (só faz sentido no acesso User; o admin não tem "visto/não visto").
  const unseenCountByTab: Record<MaterialTab, number> = useMemo(() => ({
    videoteca: videos.filter(v => !viewedIds.has(v.id)).length,
    aulas: aulas.filter(a => !viewedIds.has(a.id)).length
  }), [videos, aulas, viewedIds]);

  // Nº de visualizações por material (contagem bruta, sem deduplicar) —
  // exibido no card para o admin.
  const viewCountByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    allViewLogs.forEach(log => { map[log.materialId] = (map[log.materialId] || 0) + 1; });
    return map;
  }, [allViewLogs]);

  // Nomes únicos de quem visualizou cada material, para o tooltip do
  // contador de visualizações — sem repetir quem já apareceu.
  const viewerNamesByMaterial = useMemo(() => {
    const map: Record<string, string[]> = {};
    const seenByMaterial: Record<string, Set<string>> = {};
    allViewLogs.forEach(log => {
      if (!seenByMaterial[log.materialId]) { seenByMaterial[log.materialId] = new Set(); map[log.materialId] = []; }
      const key = log.userName || log.userId;
      if (!seenByMaterial[log.materialId].has(key)) {
        seenByMaterial[log.materialId].add(key);
        map[log.materialId].push(key);
      }
    });
    return map;
  }, [allViewLogs]);

  const handleOpenItem = async (item: MaterialItem) => {
    setViewingItem(item);
    // viewedIds e allViewLogs são assinaturas ao vivo — o novo registro
    // reflete sozinho assim que o Firestore confirma a escrita, sem precisar
    // atualizar o estado local otimisticamente aqui.
    if (currentUser) {
      await logMaterialView(item.id, item.kind === 'videoteca' ? 'video' : 'aula', currentUser.id, currentUser.name);
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
      // Não precisa recarregar manualmente — a assinatura ao vivo já
      // remove o card assim que o Firestore confirma a exclusão.
      if (item.kind === 'videoteca') await deleteVideotecaItem(item.id);
      else await deleteAulaItem(item.id);
    } catch (err) {
      alert("Erro ao excluir material.");
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Tabs — topo da página, cada uma ocupando 50% da largura */}
      <div className="flex items-stretch gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
        {(['videoteca', 'aulas'] as const).map(t => {
          const unseenCount = unseenCountByTab[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setAreaFilterIds([]); setThemeFilterIds([]); }}
              className={`w-1/2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                tab === t ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t === 'videoteca' ? 'Videoteca' : 'Aulas'}</span>
              {!isAdmin && unseenCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  tab === t ? 'bg-slate-950/20 text-slate-950' : 'bg-cyan-500/20 text-cyan-300'
                }`}>
                  {unseenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtros + botão de inserir (admin) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <CheckboxMultiSelect
            label="Área"
            options={availableAreas.map(a => ({ id: a.id, label: a.name }))}
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
            <h2 className="text-sm font-bold text-[#05413b]">{areaName}</h2>
            <MaterialGrid items={groupItems} themes={themes} viewedIds={viewedIds} viewCountByMaterial={viewCountByMaterial} viewerNamesByMaterial={viewerNamesByMaterial} isAdmin={isAdmin} onOpen={handleOpenItem} onEdit={handleOpenEdit} onDelete={handleDelete} />
          </div>
        ))
      ) : (
        <MaterialGrid items={items} themes={themes} viewedIds={viewedIds} viewCountByMaterial={viewCountByMaterial} viewerNamesByMaterial={viewerNamesByMaterial} isAdmin={isAdmin} onOpen={handleOpenItem} onEdit={handleOpenEdit} onDelete={handleDelete} />
      )}

      {modalOpen && isAdmin && (
        <MaterialFormModal
          tab={tab}
          areas={areas}
          editingItem={editingItem}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}

      {viewingItem && (
        <ViewMaterialModal
          item={viewingItem}
          isAdmin={isAdmin}
          viewLogs={allViewLogs
            .filter(l => l.materialId === viewingItem.id)
            .sort((a, b) => {
              const toSeconds = (v: any) => v && typeof v === 'object' && 'seconds' in v ? v.seconds : (v instanceof Date ? v.getTime() / 1000 : 0);
              return toSeconds(b.viewedAt) - toSeconds(a.viewedAt);
            })}
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
  viewCountByMaterial: Record<string, number>;
  viewerNamesByMaterial: Record<string, string[]>;
  isAdmin: boolean;
  onOpen: (item: MaterialItem) => void;
  onEdit: (item: MaterialItem) => void;
  onDelete: (item: MaterialItem) => void;
}> = ({ items, themes, viewedIds, viewCountByMaterial, viewerNamesByMaterial, isAdmin, onOpen, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => {
        const themeNames = item.themeIds
          .map(id => themes.find(t => t.id === id)?.name)
          .filter((n): n is string => !!n);
        const thumbnail = item.kind === 'videoteca' ? youTubeThumbnailUrl(item.url) : null;
        const aulaEmbedUrl = item.kind === 'aulas' ? toPresentEmbedUrl(item.url) : null;
        const seen = viewedIds.has(item.id);
        const viewCount = viewCountByMaterial[item.id] || 0;
        const viewerNames = viewerNamesByMaterial[item.id] || [];
        return (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-xl transition-all group relative"
          >
            {isAdmin && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                  title="Editar material"
                  className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-[#05413b] backdrop-blur-sm"
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
                <p className="px-3 pt-3 text-sm font-bold text-[#05413b] line-clamp-2 pr-14">{item.title}</p>
              </div>
              <div className="mt-2 aspect-video bg-slate-950 relative overflow-hidden">
                {thumbnail ? (
                  <img src={thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : aulaEmbedUrl ? (
                  // pointer-events-none faz o clique "atravessar" o iframe e
                  // cair no <button> pai, em vez de ser capturado pelos
                  // controles internos do player do Canva/Slides.
                  <iframe
                    src={aulaEmbedUrl}
                    title={item.title}
                    loading="lazy"
                    className="w-full h-full pointer-events-none"
                  />
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
              {themeNames.length > 0 && (
                <div className={`px-3 mt-2 flex flex-wrap gap-1 ${isAdmin ? '' : 'pb-3'}`}>
                  {themeNames.map(name => (
                    <span key={name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="relative px-3 py-2 group/viewcount w-fit">
                  <p
                    title={viewerNames.length > 0 ? viewerNames.join(', ') : undefined}
                    className="text-[10px] text-slate-500 flex items-center gap-1 cursor-default"
                  >
                    <UsersIcon className="w-3 h-3" />
                    {viewCount} visualizaç{viewCount === 1 ? 'ão' : 'ões'}
                  </p>
                  {viewerNames.length > 0 && (
                    <div className="absolute left-3 bottom-full mb-1 z-20 hidden group-hover/viewcount:block w-max max-w-[14rem] bg-slate-950 border border-slate-700 rounded-lg shadow-2xl px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-300 leading-relaxed">{viewerNames.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
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
        createNotification({
          type: tab === 'videoteca' ? 'video_created' : 'aula_created',
          message: tab === 'videoteca'
            ? `${currentUser.name} inseriu novo material na Videoteca - ${title}`
            : `${currentUser.name} inseriu novo material em Aulas - ${title}`,
          audience: 'users_only',
          actorId: currentUser.id,
          actorName: currentUser.name
        }).catch(err => console.error('Erro ao criar notificação de material:', err));
      }
      onSaved();
    } catch (err: any) {
      alert("Erro ao salvar material: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#05413b]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-[#05413b]">
            {editingItem ? 'Editar' : 'Inserir'} {tab === 'videoteca' ? 'Vídeo' : 'Aula'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#05413b]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#05413b]" />
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
              <input required type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#05413b]" />
            ) : (
              <>
                <textarea
                  required
                  rows={4}
                  placeholder='Cole aqui o <iframe> de "Compartilhar > Incorporar" do Canva, ou a URL de apresentação do Google Slides'
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[#05413b] font-mono text-[11px]"
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

  const viewersPanel = isAdmin && (
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
  );

  // Aulas abrem em tela cheia (o material em si já é a "capa" mostrada no
  // card, então aqui só falta a experiência ampliada). Videoteca mantém o
  // modal centralizado de sempre.
  if (item.kind === 'aulas') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#05413b] shrink-0">
          <h3 className="text-sm font-bold text-white truncate pr-4">{item.title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0">
          {embedUrl ? (
            <iframe src={embedUrl} title={item.title} className="w-full h-full" allowFullScreen allow="fullscreen" />
          ) : (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center text-cyan-400 text-sm underline">
              Abrir material em nova aba
            </a>
          )}
        </div>
        {isAdmin && (
          <div className="shrink-0 max-h-52 overflow-y-auto bg-slate-900 border-t border-slate-800">
            {viewersPanel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#05413b]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h3 className="text-sm font-bold text-[#05413b] truncate pr-4">{item.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#05413b] shrink-0"><X className="w-4 h-4" /></button>
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
        {viewersPanel}
      </div>
    </div>
  );
};
