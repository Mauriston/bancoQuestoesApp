import { AppNotification, AppUser, UserRole } from '../types';

// Grupo (turma) de residentes: 'hma' = residentes HMA (perfil
// 'user'), 'hnmd' = Hospital Naval Marcílio Dias (perfil 'user_hnmd'). Os
// dois perfis têm o mesmo acesso às páginas (exceto Cronograma, só HMA), mas
// notificações de colegas e desempenho/ranking consideram só o próprio grupo.
export type ResidentCohort = 'hma' | 'hnmd';

export const COHORT_LABEL: Record<ResidentCohort, string> = {
  hma: 'HMA',
  hnmd: 'HNMD'
};

export const COHORT_ROLE: Record<ResidentCohort, UserRole> = {
  hma: 'user',
  hnmd: 'user_hnmd'
};

export function isResidentRole(role?: UserRole | string | null): boolean {
  return role === 'user' || role === 'user_hnmd';
}

export function cohortOfRole(role?: UserRole | null): ResidentCohort | null {
  if (role === 'user') return 'hma';
  if (role === 'user_hnmd') return 'hnmd';
  return null;
}

// Cronograma é o do Treinamento HMA TEOT 2027 — só para residentes HMA.
export function canSeeCronograma(role?: UserRole | null): boolean {
  return role === 'user';
}

// Quem vê cada notificação (lista, badge e pop-ups):
// - eventos de residentes (audience 'all'): admin e leitor veem todos;
//   residentes só os de colegas do mesmo grupo;
// - avisos do admin (audience 'users_only'): só residentes, filtrados por
//   targetCohorts quando o aviso diz respeito a um grupo só;
// - acompanhamento do admin (audience 'admin_only'): só o admin.
// Nunca a própria ação de quem está logado.
export function isNotificationVisibleTo(n: AppNotification, viewer: AppUser): boolean {
  if (n.actorId === viewer.id) return false;
  if (n.audience === 'admin_only') return viewer.role === 'admin';
  const viewerCohort = cohortOfRole(viewer.role);
  if (n.audience === 'users_only') {
    if (!viewerCohort) return false;
    return !n.targetCohorts || n.targetCohorts.length === 0 || n.targetCohorts.includes(viewerCohort);
  }
  if (!viewerCohort) return true;
  return (n.actorCohort ?? 'hma') === viewerCohort;
}
