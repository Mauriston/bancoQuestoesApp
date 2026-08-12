import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeNotifications, subscribeNotificationReadState } from '../services/firebaseService';
import { AppNotification } from '../types';

function toSeconds(value: any): number {
  if (!value) return 0;
  if (typeof value === 'object' && 'seconds' in value) return value.seconds;
  if (value instanceof Date) return value.getTime() / 1000;
  return 0;
}

// Notificações relevantes para o usuário logado (audiência certa, sem
// contar a própria ação da pessoa) e a contagem de não lidas — usado pelo
// badge do avatar (topbar/menu lateral) e pela NotificationsPage.
export function useUnreadNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeNotifications(setNotifications);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) { setLastReadAt(null); return; }
    const unsubscribe = subscribeNotificationReadState(currentUser.id, setLastReadAt);
    return unsubscribe;
  }, [currentUser?.id]);

  const relevant = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(n =>
      (n.audience === 'all' || currentUser.role === 'user') &&
      n.actorId !== currentUser.id
    );
  }, [notifications, currentUser]);

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    const lastReadSeconds = lastReadAt ? lastReadAt.getTime() / 1000 : 0;
    return relevant.filter(n => toSeconds(n.createdAt) > lastReadSeconds).length;
  }, [relevant, lastReadAt, currentUser]);

  return { notifications: relevant, unreadCount, lastReadAt };
}
