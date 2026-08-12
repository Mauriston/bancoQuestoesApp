import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeVideotecaItems, subscribeAulaItems, subscribeViewedMaterialIds } from '../services/firebaseService';
import { VideotecaItem, AulaItem } from '../types';

// Total de materiais (Videoteca + Aulas) ainda não vistos pelo usuário
// logado — usado pelo badge do item "Extras" no menu lateral (só faz
// sentido no acesso User; o admin não tem "visto/não visto").
export function useUnseenExtrasCount(): number {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<VideotecaItem[]>([]);
  const [aulas, setAulas] = useState<AulaItem[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubVideos = subscribeVideotecaItems(setVideos);
    const unsubAulas = subscribeAulaItems(setAulas);
    return () => { unsubVideos(); unsubAulas(); };
  }, []);

  useEffect(() => {
    if (!currentUser) { setViewedIds(new Set()); return; }
    const unsubscribe = subscribeViewedMaterialIds(currentUser.id, setViewedIds);
    return unsubscribe;
  }, [currentUser?.id]);

  if (!currentUser) return 0;
  const unseenVideos = videos.filter(v => !viewedIds.has(v.id)).length;
  const unseenAulas = aulas.filter(a => !viewedIds.has(a.id)).length;
  return unseenVideos + unseenAulas;
}
