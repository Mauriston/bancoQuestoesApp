import React, { useEffect } from 'react';
import { Bell, FileCheck, PlayCircle, MessageSquare, Video, GraduationCap } from 'lucide-react';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { markNotificationsRead } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { AppNotification } from '../types';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function formatRelative(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return date.toLocaleDateString('pt-BR');
}

const ICONS: Record<AppNotification['type'], React.ElementType> = {
  exam_started: PlayCircle,
  exam_completed: FileCheck,
  exam_activated: FileCheck,
  sabatina_created: MessageSquare,
  video_created: Video,
  aula_created: GraduationCap
};

// Página compartilhada (User e Admin) de notificações — lista tudo que é
// relevante para o papel do usuário logado (ver useUnreadNotifications) e
// marca como lido assim que a página é aberta.
export const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { notifications, lastReadAt } = useUnreadNotifications();

  useEffect(() => {
    if (currentUser) {
      markNotificationsRead(currentUser.id);
    }
  }, [currentUser?.id]);

  const lastReadSeconds = lastReadAt ? lastReadAt.getTime() / 1000 : 0;

  return (
    <div className="max-w-2xl space-y-4 pb-12">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <Bell className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#05413b] leading-tight">Notificações</h1>
          <p className="text-xs text-slate-400">Eventos recentes relevantes para você</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">Nenhuma notificação por enquanto.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden shadow-xl">
          {notifications.map(n => {
            const Icon = ICONS[n.type] || Bell;
            const createdAt = toDate(n.createdAt);
            const createdSeconds = createdAt ? createdAt.getTime() / 1000 : 0;
            const isUnread = createdSeconds > lastReadSeconds;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3.5 ${isUnread ? 'bg-cyan-500/5' : ''}`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-200 leading-snug">{n.message}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{formatRelative(createdAt)}</p>
                </div>
                {isUnread && <span className="w-2 h-2 rounded-full bg-[#E20018] shrink-0 mt-1.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
